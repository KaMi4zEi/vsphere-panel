import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminOrMod, canManageRole } from "@/lib/permissions";
import { badRequest, readJsonObject } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit-log";

async function canManageTarget(session: any, userId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return target && canManageRole(session.user.role, target.role);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!(await canManageTarget(session, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const vmId = (await readJsonObject(req))?.vmId;
  if (typeof vmId !== "string") return badRequest("vmId requis");
  const vm = await prisma.vM.findUnique({ where: { id: vmId }, select: { isInfra: true } });
  if (!vm) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });
  if (vm.isInfra) return NextResponse.json({ error: "Une VM d’infrastructure ne peut pas être attribuée" }, { status: 409 });
  const assignment = await prisma.assignment.upsert({
    where: { userId_vmId: { userId: id, vmId } },
    update: {},
    create: { userId: id, vmId },
    include: { vm: true },
  });
  await writeAuditLog({ action: "VM_ASSIGNED", session, targetType: "user", targetId: id, targetLabel: id, details: `VM : ${assignment.vm.name}` });
  return NextResponse.json(assignment);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!(await canManageTarget(session, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const vmId = (await readJsonObject(req))?.vmId;
  if (typeof vmId !== "string") return badRequest("vmId requis");
  const vm = await prisma.vM.findUnique({ where: { id: vmId }, select: { isInfra: true } });
  if (!vm) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });
  if (vm.isInfra && session!.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.assignment.deleteMany({ where: { userId: id, vmId } });
  await writeAuditLog({ action: "VM_UNASSIGNED", session, targetType: "user", targetId: id, targetLabel: id, details: `VM : ${vmId}` });
  return NextResponse.json({ ok: true });
}
