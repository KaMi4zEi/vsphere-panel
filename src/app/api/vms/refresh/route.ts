// src/app/api/vms/refresh/route.ts
// Rafraîchit OS, CPU, RAM, disques depuis vCenter sans supprimer les VMs
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listVMs } from "@/lib/vcenter";
import { enrichVMFromVCenter } from "@/lib/vcenter-enrich";
import { isAdmin } from "@/lib/permissions";
import { badRequest, readJsonObject } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Optionnel: rafraîchir une seule VM
  const body = await readJsonObject(req);
  const singleVmId = body?.vcenterVmId;
  if (singleVmId !== undefined && (typeof singleVmId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(singleVmId))) return badRequest("Identifiant vCenter invalide");

  const vcVMs = await listVMs();
  const toRefresh = singleVmId ? vcVMs.filter(v => v.vm === singleVmId) : vcVMs;

  let refreshed = 0;
  for (const vcVm of toRefresh) {
    const enriched = await enrichVMFromVCenter(vcVm.vm, vcVm.cpu_count, vcVm.memory_size_MiB);
    await prisma.vM.updateMany({
      where: { vcenterVmId: vcVm.vm },
      data: {
        name: vcVm.name,
        vcpu: enriched.vcpu,
        ramGb: enriched.ramGb,
        ...(enriched.os ? { os: enriched.os } : {}),
        diskCount: enriched.diskCount,
        diskTotalGb: enriched.diskTotalGb,
      },
    });
    refreshed++;
  }

  await writeAuditLog({ action: "VM_REFRESHED", session, visibility: "ADMIN_ONLY", targetType: "vcenter", targetLabel: "Inventaire vCenter", details: `${refreshed} VM actualisée(s)` });
  return NextResponse.json({ refreshed, total: toRefresh.length });
}
