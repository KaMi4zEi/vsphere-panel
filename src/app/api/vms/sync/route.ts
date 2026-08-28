import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listVMs } from "@/lib/vcenter";
import { enrichVMFromVCenter } from "@/lib/vcenter-enrich";
import { badRequest, readJsonObject } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readJsonObject(req);
  const confirmDeletes = body?.confirmDeletes ?? false;
  if (typeof confirmDeletes !== "boolean") return badRequest("Confirmation invalide");
  const vcVMs = await listVMs();
  if (vcVMs.length === 0) return NextResponse.json({ error: "Inventaire vCenter vide : synchronisation annulée" }, { status: 409 });

  const localVMs = await prisma.vM.findMany({ select: { id: true, vcenterVmId: true } });
  const vcIds = new Set(vcVMs.map(vm => vm.vm));
  const toDelete = localVMs.filter(vm => !vcIds.has(vm.vcenterVmId));
  if (localVMs.length && toDelete.length / localVMs.length > 0.25 && !confirmDeletes) {
    return NextResponse.json({ error: "La synchronisation supprimerait plus de 25 % de l’inventaire", requiresConfirmation: true, deleteCount: toDelete.length }, { status: 409 });
  }

  const enriched = await Promise.all(vcVMs.map(async vm => ({ vm, details: await enrichVMFromVCenter(vm.vm, vm.cpu_count, vm.memory_size_MiB) })));
  const existingIds = new Set(localVMs.map(vm => vm.vcenterVmId));
  await prisma.$transaction(async tx => {
    for (const { vm, details } of enriched) {
      await tx.vM.upsert({
        where: { vcenterVmId: vm.vm },
        update: { name: vm.name, vcpu: details.vcpu, ramGb: details.ramGb, ...(details.os ? { os: details.os } : {}), diskCount: details.diskCount, diskTotalGb: details.diskTotalGb },
        create: { vcenterVmId: vm.vm, name: vm.name, os: details.os, vcpu: details.vcpu, ramGb: details.ramGb, diskCount: details.diskCount, diskTotalGb: details.diskTotalGb },
      });
    }
    if (toDelete.length) await tx.vM.deleteMany({ where: { id: { in: toDelete.map(vm => vm.id) } } });
  });
  await writeAuditLog({ action: "VM_SYNCED", session, visibility: "ADMIN_ONLY", targetType: "vcenter", targetLabel: "Inventaire vCenter", details: `${vcVMs.length} synchronisées, ${toDelete.length} supprimées` });
  return NextResponse.json({ synced: vcVMs.length, added: vcVMs.filter(vm => !existingIds.has(vm.vm)).length, updated: vcVMs.filter(vm => existingIds.has(vm.vm)).length, removed: toDelete.length });
}
