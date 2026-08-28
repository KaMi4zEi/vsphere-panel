import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminOrMod, canManageRole } from "@/lib/permissions";
import { badRequest, readJsonObject } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit-log";

function visibleRole(session: any, role: "ADMIN" | "MODERATOR" | "USER") {
  return session.user.role === "ADMIN" || role === "USER";
}

// GET — liste des users assignés à cette VM + liste des users disponibles
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: vmId } = await params;
  const vm = await prisma.vM.findUnique({ where: { id: vmId }, select: { isInfra: true } });
  if (!vm) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });
  if (vm.isInfra && session!.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [assignments, allUsers] = await Promise.all([
    prisma.assignment.findMany({
      where: { vmId },
      include: { user: { select: { id: true, username: true, email: true, role: true } } },
    }),
    prisma.user.findMany({
      select: { id: true, username: true, email: true, role: true },
      orderBy: { username: "asc" },
    }),
  ]);

  return NextResponse.json({
    assignments: assignments.filter(a => visibleRole(session, a.user.role)),
    allUsers: allUsers.filter(u => visibleRole(session, u.role)),
  });
}

// POST — assigner un user à cette VM
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: vmId } = await params;
  const vm = await prisma.vM.findUnique({ where: { id: vmId }, select: { isInfra: true } });
  if (!vm) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });
  if (vm.isInfra) return NextResponse.json({ error: "Les VM d’infrastructure ne sont pas attribuables" }, { status: 409 });
  const userId = (await readJsonObject(req))?.userId;
  if (typeof userId !== "string") return badRequest("userId requis");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || !canManageRole((session!.user as any).role, target.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assignment = await prisma.assignment.upsert({
    where: { userId_vmId: { userId, vmId } },
    update: {},
    create: { userId, vmId },
    include: { user: { select: { id: true, username: true, email: true, role: true } } },
  });
  await writeAuditLog({ action: "VM_ASSIGNED", session, targetType: "vm", targetId: vmId, targetLabel: vmId, details: `Utilisateur : ${assignment.user.username}` });
  return NextResponse.json(assignment);
}

// DELETE — retirer l'attribution d'un user de cette VM
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: vmId } = await params;
  const vm = await prisma.vM.findUnique({ where: { id: vmId }, select: { isInfra: true } });
  if (!vm) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });
  if (vm.isInfra && session!.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (await readJsonObject(req))?.userId;
  if (typeof userId !== "string") return badRequest("userId requis");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || !canManageRole((session!.user as any).role, target.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.assignment.deleteMany({ where: { userId, vmId } });
  await writeAuditLog({ action: "VM_UNASSIGNED", session, targetType: "vm", targetId: vmId, targetLabel: vmId, details: `Utilisateur : ${userId}` });
  return NextResponse.json({ ok: true });
}
