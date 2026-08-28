import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSecret, generateURI, verify } from "otplib";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { badRequest, readJsonObject } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit-log";

const sensitiveHeaders = { "Cache-Control": "no-store, private" };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const secret = generateSecret();
  const userId = (session.user as any).id;
  const throttle = rateLimit(`totp-generate:${userId}`, 5, 10 * 60_000);
  if (!throttle.allowed) return NextResponse.json({ error: "Trop de générations rapprochées" }, { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  const siteName = s?.siteName ?? "vSphere Panel";
  await prisma.user.update({ where: { id: userId }, data: { totpPendingSecret: encryptSecret(secret), totpPendingAt: new Date() } });
  const uri = generateURI({ label: user.email, issuer: siteName, secret });
  return NextResponse.json({ secret, uri }, { headers: sensitiveHeaders });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJsonObject(req);
  const code = body?.code;
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return badRequest("Code invalide");
  const userId = session.user.id;
  const throttle = rateLimit(`totp-confirm:${userId}`, 10, 10 * 60_000);
  if (!throttle.allowed) return NextResponse.json({ error: "Trop de tentatives" }, { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpPendingSecret: true, totpPendingAt: true } });
  if (!user?.totpPendingSecret || !user.totpPendingAt || Date.now() - user.totpPendingAt.getTime() > 10 * 60_000) {
    await prisma.user.update({ where: { id: userId }, data: { totpPendingSecret: null, totpPendingAt: null } });
    return badRequest("La configuration TOTP a expiré. Générez un nouveau QR code");
  }
  let secret: string;
  try {
    secret = decryptSecret(user.totpPendingSecret);
  } catch {
    return badRequest("Configuration TOTP expirée ou invalide");
  }
  const result = await verify({ token: code, secret, epochTolerance: 30 });
  if (!result.valid) return NextResponse.json({ error: "Code invalide" }, { status: 400 });
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encryptSecret(secret), totpPendingSecret: null, totpPendingAt: null, totpEnabled: true, totpDisabled: false, totpDisabledUntil: null },
  });
  await writeAuditLog({ action: "TOTP_CONFIGURED", session, targetType: "user", targetId: userId, targetLabel: session.user.email ?? "" });
  return NextResponse.json({ ok: true }, { headers: sensitiveHeaders });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } });
  if (!user || user.totpForced) {
    return NextResponse.json({ error: "Le TOTP est obligatoire pour ce compte" }, { status: 403 });
  }
  await prisma.user.update({
    where: { id: (session.user as any).id },
    data: { totpEnabled: false, totpSecret: null, totpPendingSecret: null, totpPendingAt: null },
  });
  await writeAuditLog({ action: "TOTP_RESET", session, targetType: "user", targetId: session.user.id, targetLabel: session.user.email ?? "" });
  return NextResponse.json({ ok: true });
}
