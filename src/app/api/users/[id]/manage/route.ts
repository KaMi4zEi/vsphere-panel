import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminOrMod, canManageRole, requiresTotp } from "@/lib/permissions";
import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sendPasswordReset } from "@/lib/mailer";
import { badRequest, readJsonObject } from "@/lib/http";
import { generateTemporaryPassword } from "@/lib/password-policy";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await readJsonObject(req);
  const action = body?.action;
  if (typeof action !== "string") return badRequest("Action invalide");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const actorRole = (session as any)?.user?.role;
  if (!canManageRole(actorRole, user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (id === session!.user.id && ["reset_password", "reset_totp", "disable_totp"].includes(String(action))) {
    return NextResponse.json({ error: "Cette action ne peut pas être appliquée à votre propre compte" }, { status: 409 });
  }

  if (action === "change_role") {
    if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (id === session!.user.id) return NextResponse.json({ error: "Vous ne pouvez pas modifier votre propre rôle" }, { status: 409 });
    const targetRole = body?.role;
    if (typeof targetRole !== "string" || !["ADMIN", "MODERATOR", "USER"].includes(targetRole)) return badRequest("Rôle invalide");
    try {
      const updated = await prisma.$transaction(async transaction => {
        const currentUser = await transaction.user.findUnique({ where: { id }, select: { role: true } });
        if (!currentUser) throw new Error("USER_NOT_FOUND");
        if (currentUser.role === "ADMIN" && targetRole !== "ADMIN" && await transaction.user.count({ where: { role: "ADMIN" } }) <= 1) {
          throw new Error("LAST_ADMIN");
        }
        return transaction.user.update({
          where: { id },
          data: { role: targetRole as Role, totpForced: requiresTotp(targetRole as Role), totpDisabled: false, totpDisabledUntil: null, sessionVersion: { increment: 1 } },
          select: { role: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await writeAuditLog({ action: "ROLE_CHANGED", session, visibility: "ADMIN_ONLY", targetType: "user", targetId: id, targetLabel: user.username, details: `${user.role} → ${updated.role}` });
      return NextResponse.json({ ok: true, role: updated.role, message: "Rôle mis à jour" });
    } catch (error) {
      if (error instanceof Error && error.message === "LAST_ADMIN") return NextResponse.json({ error: "Le dernier administrateur ne peut pas être rétrogradé" }, { status: 409 });
      if (error instanceof Error && error.message === "USER_NOT_FOUND") return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Modification concurrente détectée, réessayez" }, { status: 409 });
      throw error;
    }
  }

  if (action === "reset_password") {
    const newPwd = generateTemporaryPassword();
    const sent = await sendPasswordReset({ to: user.email, username: user.username, newPassword: newPwd });
    if (!sent) return NextResponse.json({ error: "Configurez le SMTP avant de réinitialiser un mot de passe" }, { status: 409 });
    const hash = await bcrypt.hash(newPwd, 12);
    await prisma.user.update({ where: { id }, data: { password: hash, passwordResetAt: new Date(), mustChangePassword: true, sessionVersion: { increment: 1 } } });
    await writeAuditLog({ action: "PASSWORD_RESET", session, targetType: "user", targetId: id, targetLabel: user.username });
    return NextResponse.json({ ok: true, message: "Mot de passe réinitialisé et envoyé par email" });
  }

  if (action === "reset_totp") {
    await prisma.user.update({ where: { id }, data: { totpEnabled: false, totpSecret: null, totpPendingSecret: null, totpPendingAt: null, totpDisabled: false, totpDisabledUntil: null, sessionVersion: { increment: 1 } } });
    await writeAuditLog({ action: "TOTP_RESET", session, targetType: "user", targetId: id, targetLabel: user.username });
    return NextResponse.json({ ok: true, message: "TOTP réinitialisé" });
  }

  if (action === "disable_totp") {
    const durationMinutes = body?.durationMinutes;
    if (typeof durationMinutes !== "number" || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 10_080) return badRequest("Durée de dérogation invalide");
    const totpDisabledUntil = new Date(Date.now() + durationMinutes * 60_000);
    await prisma.user.update({ where: { id }, data: { totpDisabled: true, totpDisabledUntil, sessionVersion: { increment: 1 } } });
    await writeAuditLog({ action: "TOTP_DISABLED", session, targetType: "user", targetId: id, targetLabel: user.username, details: `Jusqu’au ${totpDisabledUntil.toISOString()}` });
    return NextResponse.json({ ok: true, totpDisabledUntil, message: "TOTP désactivé jusqu’à l’expiration indiquée" });
  }

  if (action === "enable_totp") {
    await prisma.user.update({ where: { id }, data: { totpDisabled: false, totpDisabledUntil: null, sessionVersion: { increment: 1 } } });
    await writeAuditLog({ action: "TOTP_ENABLED", session, targetType: "user", targetId: id, targetLabel: user.username });
    return NextResponse.json({ ok: true, message: "TOTP réactivé" });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
