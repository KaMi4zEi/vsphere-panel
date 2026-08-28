import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, isAdminOrMod } from "@/lib/permissions";
import { enrichVMFromVCenter } from "@/lib/vcenter-enrich";
import { badRequest, readJsonObject } from "@/lib/http";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (isAdminOrMod(session)) {
    const vms = await prisma.vM.findMany({
      where: session.user.role === "MODERATOR" ? { isInfra: false } : undefined,
      include: { assignments: { include: { user: { select: { id: true, username: true } } } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(vms);
  }

  const userId = session.user.id;
  const assignments = await prisma.assignment.findMany({ where: { userId, vm: { isInfra: false } }, include: { vm: true } });
  return NextResponse.json(assignments.map((a) => a.vm));
}

// Seul ADMIN peut ajouter des VMs manuellement
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readJsonObject(req);
  if (!body) return badRequest();
  const { vcenterVmId, name, vcpu: baseCpu, memory_size_MiB, notes, isInfra } = body;
  const validCpu = baseCpu === undefined || (typeof baseCpu === "number" && Number.isInteger(baseCpu) && baseCpu >= 1 && baseCpu <= 1024);
  const validMemory = memory_size_MiB === undefined || (typeof memory_size_MiB === "number" && Number.isFinite(memory_size_MiB) && memory_size_MiB >= 1);
  if (typeof vcenterVmId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(vcenterVmId) ||
      typeof name !== "string" || name.trim().length < 1 || name.trim().length > 120 ||
      !validCpu || !validMemory ||
      (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 4000)) ||
      (isInfra !== undefined && typeof isInfra !== "boolean")) return badRequest("Données de VM invalides");

  // Enrichir avec les données vCenter (OS, disques, config précise)
  const enriched = await enrichVMFromVCenter(vcenterVmId, typeof baseCpu === "number" ? baseCpu : 1, typeof memory_size_MiB === "number" ? memory_size_MiB : 1024);

  const vm = await prisma.vM.create({
    data: {
      vcenterVmId, name: name.trim(),
      os: enriched.os,
      vcpu: enriched.vcpu,
      ramGb: enriched.ramGb,
      diskCount: enriched.diskCount,
      diskTotalGb: enriched.diskTotalGb,
      notes: typeof notes === "string" ? notes.trim() || null : null,
      isInfra: isInfra ?? false,
    },
  });
  await writeAuditLog({ action: "VM_CREATED", session, visibility: "ADMIN_ONLY", targetType: "vm", targetId: vm.id, targetLabel: vm.name, details: vm.vcenterVmId });
  return NextResponse.json(vm, { status: 201 });
}

// Seul ADMIN peut supprimer des VMs
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const vmId = (await readJsonObject(req))?.vmId;
  if (typeof vmId !== "string") return badRequest("vmId requis");
  const existing = await prisma.vM.findUnique({ where: { id: vmId }, select: { name: true, vcenterVmId: true } });
  try {
    await prisma.vM.delete({ where: { id: vmId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "VM introuvable" }, { status: 404 });
    throw error;
  }
  await writeAuditLog({ action: "VM_DELETED", session, visibility: "ADMIN_ONLY", targetType: "vm", targetId: vmId, targetLabel: existing?.name ?? vmId, details: existing?.vcenterVmId });
  return NextResponse.json({ ok: true });
}
