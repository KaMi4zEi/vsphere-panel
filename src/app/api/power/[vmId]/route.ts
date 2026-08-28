// src/app/api/power/[vmId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { powerOnVM, shutdownVM, getVMPower } from "@/lib/vcenter";
import { sendVmPowerNotifications, sendInfraPowerNotification } from "@/lib/mailer";
import { badRequest, readJsonObject } from "@/lib/http";
import { canUseVM, type Role } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { isIP } from "net";
import { writeAuditLog } from "@/lib/audit-log";

function getIP(req: NextRequest): string {
  // CF-Connecting-IP (Cloudflare) > X-Real-IP (NPM) > X-Forwarded-For (premier hop) > fallback
  const cf = req.headers.get("cf-connecting-ip");
  if (cf && isIP(cf.trim())) return cf.trim();
  const xri = req.headers.get("x-real-ip");
  if (xri && isIP(xri.trim())) return xri.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // Prendre la première IP non-privée, sinon la première tout court
    const ips = xff.split(",").map(s => s.trim()).filter(ip => Boolean(isIP(ip)));
    const publicIp = ips.find(ip => !ip.startsWith("172.") && !ip.startsWith("10.") && !ip.startsWith("192.168.") && ip !== "::1");
    return publicIp ?? ips[0] ?? "inconnue";
  }
  return "inconnue";
}

async function canAccessVM(userId: string, vmId: string, role: string) {
  const vm = await prisma.vM.findUnique({ where: { id: vmId }, select: { isInfra: true } });
  if (!vm) return false;
  if (role === "ADMIN" || role === "MODERATOR") return canUseVM(role, vm.isInfra, false);
  const assignment = await prisma.assignment.findUnique({
    where: { userId_vmId: { userId, vmId } },
  });
  return canUseVM(role as Role, vm.isInfra, Boolean(assignment));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ vmId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { vmId } = await params;
  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const vm = await prisma.vM.findUnique({ where: { id: vmId } });
  if (!vm) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });
  const hasAccess = await canAccessVM(userId, vmId, role);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const throttle = rateLimit(`power-state:${userId}:${vmId}`, 60, 60_000);
  if (!throttle.allowed) return NextResponse.json({ error: "Trop de demandes" }, { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } });
  const state = await getVMPower(vm.vcenterVmId);
  return NextResponse.json({ state });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ vmId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { vmId } = await params;
  const userId = (session.user as any).id;
  const userName = session.user?.name ?? "";
  const role = (session.user as any).role;
  const ipAddress = getIP(req);
  const vm = await prisma.vM.findUnique({ where: { id: vmId } });
  if (!vm) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });

  const hasAccess = await canAccessVM(userId, vmId, role);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const action = (await readJsonObject(req))?.action;
  if (action !== "start" && action !== "stop") {
    return badRequest("Action invalide (start | stop)");
  }
  const throttle = rateLimit(`power:${userId}:${vmId}`, 6, 60_000);
  if (!throttle.allowed) return NextResponse.json({ error: "Trop d’actions rapprochées" }, {
    status: 429,
    headers: { "Retry-After": String(throttle.retryAfter) },
  });

  const dbAction = action === "start" ? "POWER_ON" : "POWER_OFF";

  try {
    if (action === "start") await powerOnVM(vm.vcenterVmId);
    else await shutdownVM(vm.vcenterVmId);
  } catch (err) {
    await writeAuditLog({ action: dbAction, session, targetType: "vm", targetId: vmId, targetLabel: vm.name, details: vm.vcenterVmId, success: false, ipAddress });
    console.error("[vcenter] power action failed", err);
    return NextResponse.json({ error: "L’action vCenter a échoué" }, { status: 502 });
  }

  await writeAuditLog({ action: dbAction, session, targetType: "vm", targetId: vmId, targetLabel: vm.name, details: vm.vcenterVmId, ipAddress });
  await prisma.vM.update({
    where: { id: vmId },
    data: { lastPowerState: action === "start" ? "POWERED_ON" : "POWERED_OFF", lastPowerCheckedAt: new Date(), lastPowerCommandAt: new Date() },
  });

  if (vm.isInfra) {
    sendInfraPowerNotification(vm.name, dbAction, userName)
      .catch((err) => console.error("[mailer] infraAlert:", err));
  } else {
    sendVmPowerNotifications(vmId, vm.name, dbAction, userName, userId)
      .catch((err) => console.error("[mailer] vmPowerAlert:", err));
  }

  return NextResponse.json({ ok: true, state: action === "start" ? "POWERED_ON" : "POWERED_OFF" });
}
