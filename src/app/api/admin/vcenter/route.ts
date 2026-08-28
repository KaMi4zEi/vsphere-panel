import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secrets";
import { badRequest, readJsonObject } from "@/lib/http";
import { invalidateVCenterSession } from "@/lib/vcenter";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const settings = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    host: settings?.vcenterHost ?? "",
    user: settings?.vcenterUser ?? "",
    hasPassword: Boolean(settings?.vcenterPass),
    tlsVerify: settings?.vcenterTlsVerify ?? true,
    monitorEnabled: settings?.vcenterMonitorEnabled ?? false,
    monitorIntervalSeconds: settings?.vcenterMonitorIntervalSeconds ?? 300,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readJsonObject(request);
  if (!body) return badRequest();
  const { host, user, pass, tlsVerify, monitorEnabled, monitorIntervalSeconds } = body;
  if (typeof host !== "string" || typeof user !== "string" || typeof tlsVerify !== "boolean" ||
      typeof monitorEnabled !== "boolean" || typeof monitorIntervalSeconds !== "number" ||
      !Number.isInteger(monitorIntervalSeconds) || monitorIntervalSeconds < 30 || monitorIntervalSeconds > 86400 ||
      (pass !== undefined && typeof pass !== "string") || host.length > 2048 || user.length > 320 || /[\r\n]/.test(user)) return badRequest("Configuration vCenter invalide");
  let normalizedHost: string;
  try {
    const url = new URL(host.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    normalizedHost = url.origin;
  } catch { return badRequest("L’adresse vCenter doit être une origine HTTPS sans chemin"); }
  if (!user.trim()) return badRequest("L’utilisateur vCenter est requis");
  const current = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  const endpointChanged = Boolean(current?.vcenterPass) &&
    (normalizedHost !== (current?.vcenterHost ?? "") || user.trim() !== (current?.vcenterUser ?? ""));
  if (endpointChanged && !(typeof pass === "string" && pass.length > 0)) {
    return badRequest("Un nouveau mot de passe est obligatoire lorsque l’adresse ou le compte vCenter change");
  }
  const storedPass = typeof pass === "string" && pass.length ? encryptSecret(pass) : current?.vcenterPass ?? null;
  if (!storedPass) return badRequest("Le mot de passe vCenter est requis");
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: { vcenterHost: normalizedHost, vcenterUser: user.trim(), vcenterPass: storedPass, vcenterTlsVerify: tlsVerify, vcenterMonitorEnabled: monitorEnabled, vcenterMonitorIntervalSeconds: monitorIntervalSeconds },
    create: { id: "singleton", vcenterHost: normalizedHost, vcenterUser: user.trim(), vcenterPass: storedPass, vcenterTlsVerify: tlsVerify, vcenterMonitorEnabled: monitorEnabled, vcenterMonitorIntervalSeconds: monitorIntervalSeconds },
  });
  invalidateVCenterSession();
  await writeAuditLog({ action: "VCENTER_SETTINGS_CHANGED", session, visibility: "ADMIN_ONLY", targetType: "settings", targetLabel: "vCenter" });
  return NextResponse.json({ ok: true });
}
