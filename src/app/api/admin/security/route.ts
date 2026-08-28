import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, readJsonObject } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit-log";

function normalizeProxyIps(value: unknown) {
  if (typeof value !== "string" || value.length > 4000) return null;
  const ips = [...new Set(value.split(/[\s,;]+/).map(item => item.trim()).filter(Boolean))];
  if (ips.length > 32 || ips.some(ip => !isIP(ip))) return null;
  return ips.join(",");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const settings = await prisma.siteSettings.findUnique({ where: { id: "singleton" }, select: { trustedProxyIps: true } });
  return NextResponse.json({ trustedProxyIps: settings?.trustedProxyIps ?? "" });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readJsonObject(request);
  const trustedProxyIps = normalizeProxyIps(body?.trustedProxyIps);
  if (trustedProxyIps === null) return badRequest("Liste d’adresses IP de proxy invalide");
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: { trustedProxyIps },
    create: { id: "singleton", trustedProxyIps },
  });
  await writeAuditLog({ action: "SITE_SETTINGS_CHANGED", session, visibility: "ADMIN_ONLY", targetType: "settings", targetLabel: "Proxys de confiance" });
  return NextResponse.json({ ok: true, trustedProxyIps });
}
