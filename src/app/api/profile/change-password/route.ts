import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { badRequest, readJsonObject } from "@/lib/http";
import { passwordPolicyError } from "@/lib/password-policy";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJsonObject(req);
  if (!body) return badRequest();
  const password = body.password;
  const policyError = passwordPolicyError(password);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }
  const validPassword = password as string;

  const userId = session.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  if (await bcrypt.compare(validPassword, user.password)) {
    return NextResponse.json({ error: "Le nouveau mot de passe doit être différent du mot de passe temporaire" }, { status: 400 });
  }

  const hash = await bcrypt.hash(validPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hash, mustChangePassword: false, passwordResetAt: new Date(), sessionVersion: { increment: 1 } },
  });
  await writeAuditLog({ action: "PASSWORD_CHANGED", session, targetType: "user", targetId: userId, targetLabel: session.user.name ?? "" });

  return NextResponse.json({ ok: true });
}
