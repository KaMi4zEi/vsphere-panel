// src/app/api/infrastructure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, readJsonObject } from "@/lib/http";
import { isAdmin } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const vms = await prisma.vM.findMany({ where: { isInfra: true }, orderBy: { name: "asc" } });
  return NextResponse.json(vms);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readJsonObject(req);
  const vmId = body?.vmId;
  const isInfra = body?.isInfra;
  if (typeof vmId !== "string" || typeof isInfra !== "boolean") return badRequest();
  const existing = await prisma.vM.findUnique({ where: { id: vmId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });
  const vm = await prisma.$transaction(async transaction => {
    if (isInfra) await transaction.assignment.deleteMany({ where: { vmId } });
    return transaction.vM.update({ where: { id: vmId }, data: { isInfra } });
  });
  await writeAuditLog({ action: "INFRASTRUCTURE_CHANGED", session, visibility: "ADMIN_ONLY", targetType: "vm", targetId: vmId, targetLabel: vm.name, details: isInfra ? "Ajoutée à l’infrastructure" : "Retirée de l’infrastructure" });
  return NextResponse.json(vm);
}
