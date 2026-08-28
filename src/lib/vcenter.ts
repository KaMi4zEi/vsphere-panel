// src/lib/vcenter.ts
import https from "https";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";

async function getVCenterConfig() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  const host = settings?.vcenterHost?.trim().replace(/\/+$/, "");
  const user = settings?.vcenterUser;
  const password = decryptSecret(settings?.vcenterPass);
  if (!host || !user || !password) throw new Error("Configuration vCenter incomplète");
  const url = new URL(host);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/") {
    throw new Error("L’adresse vCenter doit être une origine HTTPS sans identifiants ni chemin");
  }
  return { host, user, password, tlsVerify: settings?.vcenterTlsVerify ?? true };
}

function safeVmId(vmId: string) {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(vmId)) throw new Error("Identifiant vCenter invalide");
  return encodeURIComponent(vmId);
}

const agents = new Map<boolean, https.Agent>();
function getAgent(tlsVerify: boolean): https.Agent {
  if (!agents.has(tlsVerify)) agents.set(tlsVerify, new https.Agent({ rejectUnauthorized: tlsVerify }));
  return agents.get(tlsVerify)!;
}

function request(url: string, method: string, headers: Record<string, string>, tlsVerify: boolean, body?: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method, headers, agent: getAgent(tlsVerify), timeout: 15_000 }, (res) => {
      let data = "";
      res.on("data", chunk => {
        data += chunk;
        if (Buffer.byteLength(data) > 5 * 1024 * 1024) req.destroy(new Error("Réponse vCenter trop volumineuse"));
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: data }));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Délai vCenter dépassé")));
    if (body) req.write(body);
    req.end();
  });
}

let sessionToken: string | null = null;
let sessionExpiry = 0;

async function getSession(): Promise<string> {
  const config = await getVCenterConfig();
  const now = Date.now();
  if (sessionToken && now < sessionExpiry) return sessionToken;
  const { status, text } = await request(`${config.host}/api/session`, "POST", {
    Authorization: "Basic " + Buffer.from(`${config.user}:${config.password}`).toString("base64"),
  }, config.tlsVerify);
  if (status < 200 || status >= 300) throw new Error(`vCenter auth failed: ${status}`);
  sessionToken = text.replace(/^"|"$/g, "");
  sessionExpiry = now + 25 * 60 * 1000;
  return sessionToken;
}

async function vcRequest(path: string, method = "GET", body?: string): Promise<{ status: number; text: string }> {
  const config = await getVCenterConfig();
  const token = await getSession();
  const response = await request(`${config.host}${path}`, method, { "vmware-api-session-id": token, "Content-Type": "application/json" }, config.tlsVerify, body);
  if (response.status === 401) {
    sessionToken = null;
    sessionExpiry = 0;
  }
  return response;
}

export function invalidateVCenterSession() {
  sessionToken = null;
  sessionExpiry = 0;
  _soapCookie = null;
  _soapExpiry = 0;
  _counterCache = null;
}

export type VcPowerState = "POWERED_ON" | "POWERED_OFF" | "SUSPENDED";
export interface VcVM { vm: string; name: string; power_state: VcPowerState; cpu_count: number; memory_size_MiB: number; }
export interface VcVMStats {
  cpuUsagePct: number; cpuUsageMhz: number; cpuCapacityMhz: number;
  memUsagePct: number; memUsageMb: number; memCapacityMb: number;
  diskUsedGb?: number; diskTotalGb?: number;
}

function isPowerState(value: unknown): value is VcPowerState {
  return value === "POWERED_ON" || value === "POWERED_OFF" || value === "SUSPENDED";
}

function parseVMList(text: string): VcVM[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) throw new Error("Inventaire vCenter invalide");
  return value.map(item => {
    if (!item || typeof item !== "object") throw new Error("Entrée vCenter invalide");
    const vm = item as Record<string, unknown>;
    if (typeof vm.vm !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(vm.vm) ||
        typeof vm.name !== "string" || vm.name.length < 1 || vm.name.length > 120 ||
        !isPowerState(vm.power_state) || !Number.isInteger(vm.cpu_count) ||
        typeof vm.memory_size_MiB !== "number" || !Number.isFinite(vm.memory_size_MiB)) {
      throw new Error("Entrée vCenter invalide");
    }
    return vm as unknown as VcVM;
  });
}

export async function listVMs(): Promise<VcVM[]> {
  const { status, text } = await vcRequest("/api/vcenter/vm");
  if (status !== 200) throw new Error(`listVMs: ${status}`);
  return parseVMList(text);
}

export async function getVMDetail(vmId: string): Promise<any> {
  const { status, text } = await vcRequest(`/api/vcenter/vm/${safeVmId(vmId)}`);
  if (status !== 200) throw new Error(`getVMDetail: ${status}`);
  return JSON.parse(text);
}

export async function getVMGuest(vmId: string): Promise<{ os_fullname?: string }> {
  try {
    const { status, text } = await vcRequest(`/api/vcenter/vm/${safeVmId(vmId)}/guest/identity`);
    if (status === 200) {
      const data = JSON.parse(text);
      return { os_fullname: data.os_fullname ?? data.full_name?.default_message ?? "" };
    }
  } catch {}
  return {};
}

export async function getVMPower(vmId: string): Promise<VcPowerState> {
  const { status, text } = await vcRequest(`/api/vcenter/vm/${safeVmId(vmId)}/power`);
  if (status !== 200) throw new Error(`getVMPower: ${status}`);
  const state = (JSON.parse(text) as { state?: unknown }).state;
  if (!isPowerState(state)) throw new Error("État d’alimentation vCenter invalide");
  return state;
}

export async function powerOnVM(vmId: string): Promise<void> {
  const { status, text } = await vcRequest(`/api/vcenter/vm/${safeVmId(vmId)}/power?action=start`, "POST");
  if (status !== 200 && status !== 204) throw new Error(`powerOnVM: ${status} ${text}`);
}

async function powerOffVM(vmId: string): Promise<void> {
  const { status, text } = await vcRequest(`/api/vcenter/vm/${safeVmId(vmId)}/power?action=stop`, "POST");
  if (status !== 200 && status !== 204) throw new Error(`powerOffVM: ${status} ${text}`);
}

export async function shutdownVM(vmId: string): Promise<void> {
  const { status } = await vcRequest(`/api/vcenter/vm/${safeVmId(vmId)}/guest/power?action=shutdown`, "POST");
  if (status === 400 || status === 503) return powerOffVM(vmId);
  if (status !== 200 && status !== 204) throw new Error(`shutdownVM: ${status}`);
}

export interface VcDiskPartition {
  path: string;        // ex: "C:\"
  capacity: number;    // bytes
  freeSpace: number;   // bytes
  filesystem: string;
  usedPct: number;
}

export async function getVMDiskUsage(vmId: string): Promise<VcDiskPartition[]> {
  const { status, text } = await vcRequest(`/api/vcenter/vm/${safeVmId(vmId)}/guest/local-filesystem`);
  if (status !== 200) return [];
  const data = JSON.parse(text);
  return Object.entries(data).map(([path, info]: [string, any]) => ({
    path,
    capacity: info.capacity ?? 0,
    freeSpace: info.free_space ?? 0,
    filesystem: info.filesystem ?? "",
    usedPct: info.capacity > 0
      ? Math.min(100, Math.round((1 - info.free_space / info.capacity) * 100))
      : 0,
  }));
}

// ─── SOAP Performance Manager ───────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

async function soapReq(body: string, cookie?: string): Promise<{text: string; cookies: string[]}> {
  const config = await getVCenterConfig();
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.host}/sdk`);
    const agent = getAgent(config.tlsVerify);
    const buf = Buffer.from(body);
    const headers: Record<string, any> = {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "urn:vim25/8.0",
      "Content-Length": buf.length,
    };
    if (cookie) headers["Cookie"] = cookie;
    const req = https.request(
      { hostname: url.hostname, port: url.port || 443, path: url.pathname, method: "POST", headers, agent, timeout: 15_000 },
      (res) => {
        let d = "";
        const cookies = (res.headers["set-cookie"] ?? []) as string[];
        res.on("data", chunk => {
          d += chunk;
          if (Buffer.byteLength(d) > 5 * 1024 * 1024) req.destroy(new Error("Réponse SOAP trop volumineuse"));
        });
        res.on("end", () => resolve({ text: d, cookies }));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Délai SOAP vCenter dépassé")));
    req.write(buf);
    req.end();
  });
}

let _soapCookie: string | null = null;
let _soapExpiry = 0;

async function getSoapSession(): Promise<string> {
  const config = await getVCenterConfig();
  if (_soapCookie && Date.now() < _soapExpiry) return _soapCookie;
  const { cookies } = await soapReq(`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vim25="urn:vim25">
  <soapenv:Body>
    <vim25:Login>
      <vim25:_this type="SessionManager">SessionManager</vim25:_this>
      <vim25:userName>${xmlEscape(config.user)}</vim25:userName>
      <vim25:password>${xmlEscape(config.password)}</vim25:password>
    </vim25:Login>
  </soapenv:Body>
</soapenv:Envelope>`);
  const sc = cookies.find(c => c.includes("vmware_soap_session"));
  if (!sc) throw new Error("SOAP login failed");
  _soapCookie = sc.split(";")[0];
  _soapExpiry = Date.now() + 25 * 60 * 1000;
  return _soapCookie;
}

// Cache des counter IDs (ils ne changent jamais sur un vCenter donné)
let _counterCache: Map<string, number> | null = null;

async function getPerfCounterIds(cookie: string): Promise<Map<string, number>> {
  if (_counterCache) return _counterCache;

  // Lister les compteurs dispo sur une VM quelconque pour avoir les IDs
  // On utilise QueryPerfCounter avec une liste d'IDs connus
  // Alternative : QueryAvailablePerfMetric puis QueryPerfCounter
  const { text } = await soapReq(`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vim25="urn:vim25">
  <soapenv:Body>
    <vim25:QueryPerfCounter>
      <vim25:_this type="PerformanceManager">PerfMgr</vim25:_this>
      ${[2,6,24,65,125].map(id => `<vim25:counterId>${id}</vim25:counterId>`).join("\n")}
    </vim25:QueryPerfCounter>
  </soapenv:Body>
</soapenv:Envelope>`, cookie);

  const map = new Map<string, number>();
  const blocks = text.match(/<returnval>[\s\S]*?<\/returnval>/g) ?? [];
  for (const block of blocks) {
    const keyMatch = block.match(/<key>(\d+)<\/key>/);
    const groupMatch = block.match(/<groupInfo[\s\S]*?<key>([^<]+)<\/key>/);
    const nameMatch = block.match(/<nameInfo[\s\S]*?<key>([^<]+)<\/key>/);
    const rollupMatch = block.match(/<rollupType>([^<]+)<\/rollupType>/);
    if (keyMatch && groupMatch && nameMatch && rollupMatch) {
      map.set(`${groupMatch[1]}.${nameMatch[1]}.${rollupMatch[1]}`, parseInt(keyMatch[1]));
    }
  }
  _counterCache = map;
  return map;
}

export async function getVMStatsSoap(vcenterVmId: string): Promise<VcVMStats | null> {
  try {
    const cookie = await getSoapSession();

    // Récupérer les IDs des compteurs cpu.usage.average et mem.usage.average
    // Ces IDs sont stables sur un vCenter donné mais on les vérifie via le cache
    let cpuId = 2;  // identifiant de compteur détecté sur l'instance vCenter
    let memId = 24; // identifiant de compteur détecté sur l'instance vCenter

    // Essayer de les confirmer depuis le cache
    try {
      const counterMap = await getPerfCounterIds(cookie);
      cpuId = counterMap.get("cpu.usage.average") ?? cpuId;
      memId = counterMap.get("mem.usage.average") ?? memId;
    } catch {}

    // Récupérer la capacité mémoire
    let memCapacityMb = 0;
    try {
      const { status, text } = await vcRequest(`/api/vcenter/vm/${safeVmId(vcenterVmId)}`);
      if (status === 200) memCapacityMb = JSON.parse(text).memory?.size_MiB ?? 0;
    } catch {}

    // QueryPerf
    const { text } = await soapReq(`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vim25="urn:vim25">
  <soapenv:Body>
    <vim25:QueryPerf>
      <vim25:_this type="PerformanceManager">PerfMgr</vim25:_this>
      <vim25:querySpec>
        <vim25:entity type="VirtualMachine">${xmlEscape(vcenterVmId)}</vim25:entity>
        <vim25:maxSample>3</vim25:maxSample>
        <vim25:metricId>
          <vim25:counterId>${cpuId}</vim25:counterId>
          <vim25:instance></vim25:instance>
        </vim25:metricId>
        <vim25:metricId>
          <vim25:counterId>${memId}</vim25:counterId>
          <vim25:instance></vim25:instance>
        </vim25:metricId>
        <vim25:intervalId>20</vim25:intervalId>
      </vim25:querySpec>
    </vim25:QueryPerf>
  </soapenv:Body>
</soapenv:Envelope>`, cookie);

    // Parser les valeurs
    const rawValues: Record<number, number> = {};
    const blocks = text.match(/<value xsi:type="PerfMetricIntSeries">[\s\S]*?<\/value>/g) ?? [];
    for (const block of blocks) {
      const cidMatch = block.match(/<counterId>(\d+)<\/counterId>/);
      const valMatches = [...block.matchAll(/<value>(-?\d+)<\/value>/g)];
      if (cidMatch && valMatches.length > 0) {
        const vals = valMatches.map(m => parseInt(m[1])).filter(v => v >= 0);
        if (vals.length > 0) {
          rawValues[parseInt(cidMatch[1])] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        }
      }
    }

    const cpuRaw = rawValues[cpuId];
    const memRaw = rawValues[memId];

    if (cpuRaw === undefined && memRaw === undefined) return null;

    // cpu.usage est en centièmes de % (1200 = 12.00%), mem.usage aussi
    const cpuPct = cpuRaw !== undefined ? Math.min(100, Math.round(cpuRaw / 100)) : 0;
    const memPct = memRaw !== undefined ? Math.min(100, Math.round(memRaw / 100)) : 0;

    return {
      cpuUsagePct: cpuPct,
      cpuUsageMhz: 0,
      cpuCapacityMhz: 0,
      memUsagePct: memPct,
      memUsageMb: Math.round(memCapacityMb * memPct / 100),
      memCapacityMb,
    };
  } catch {
    return null;
  }
}
