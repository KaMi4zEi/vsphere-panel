import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listVMs } from "@/lib/vcenter";
import { isAdmin } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [vcVMs, localVMs] = await Promise.all([
      listVMs(),
      prisma.vM.findMany({ select: { vcenterVmId: true, name: true } }),
    ]);

    const localIds = new Set(localVMs.map(v => v.vcenterVmId));
    
    // Retourner TOUTES les VMs vCenter avec un indicateur "imported"
    const result = vcVMs.map(v => ({
      ...v,
      imported: localIds.has(v.vm),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[vcenter] inventory listing failed", error);
    return NextResponse.json({ error: "Impossible de lire l’inventaire vCenter" }, { status: 502 });
  }
}
