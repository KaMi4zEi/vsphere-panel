// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { badRequest, readJsonObject } from "@/lib/http";
import { passwordPolicyError } from "@/lib/password-policy";
import { rateLimit } from "@/lib/rate-limit";
import { isTotpBypassActive } from "@/lib/totp-policy";
import { writeAuditLog } from "@/lib/audit-log";

// GET /api/profile — infos de l'utilisateur connecté
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      totpEnabled: true,
      totpDisabled: true,
      totpDisabledUntil: true,
      totpForced: true,
      createdAt: true,
      _count: { select: { assignments: { where: { vm: { isInfra: false } } }, logs: true } },
    },
  });

  return NextResponse.json(user ? { ...user, totpDisabled: isTotpBypassActive(user.totpDisabled, user.totpDisabledUntil) } : null);
}

// PATCH /api/profile — modifier le mot de passe
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await readJsonObject(req);
  if (!body) return badRequest();
  const { currentPassword, newPassword } = body;
  const throttle = rateLimit(`profile-password:${userId}`, 5, 15 * 60_000);
  if (!throttle.allowed) return NextResponse.json({ error: "Trop de tentatives" }, { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } });

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Les deux mots de passe sont requis" }, { status: 400 });
  }

  const policyError = passwordPolicyError(newPassword);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });
  }

  if (await bcrypt.compare(newPassword, user.password)) {
    return NextResponse.json({ error: "Le nouveau mot de passe doit être différent de l’ancien" }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hash, passwordResetAt: new Date(), mustChangePassword: false, sessionVersion: { increment: 1 } } });
  await writeAuditLog({ action: "PASSWORD_CHANGED", session, targetType: "user", targetId: userId, targetLabel: user.username });

  return NextResponse.json({ ok: true, message: "Mot de passe mis à jour avec succès" });
}
