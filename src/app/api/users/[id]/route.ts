import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminOrMod, canManageRole } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit-log";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const actorRole = (session as any)?.user?.role;
  if (!canManageRole(actorRole, target.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (id === session!.user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 409 });
  }
  try {
    await prisma.$transaction(async transaction => {
      if (target.role === "ADMIN" && await transaction.user.count({ where: { role: "ADMIN" } }) <= 1) {
        throw new Error("LAST_ADMIN");
      }
      await transaction.user.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ADMIN") {
      return NextResponse.json({ error: "Le dernier administrateur ne peut pas être supprimé" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "Une modification concurrente a été détectée, réessayez" }, { status: 409 });
    }
    throw error;
  }
  await writeAuditLog({ action: "USER_DELETED", session, targetType: "user", targetId: id, targetLabel: target.username, details: `Rôle : ${target.role}` });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canManageRole(session!.user.role, target.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const assignments = await prisma.assignment.findMany({ where: { userId: id }, include: { vm: true } });
  return NextResponse.json(assignments.map((a) => a.vm));
}
