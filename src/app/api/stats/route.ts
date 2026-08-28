import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVMPower, getVMStatsSoap, getVMDiskUsage } from "@/lib/vcenter";
import { canUseVM, type Role } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const vmId = searchParams.get("vmId");
  if (!vmId) return NextResponse.json({ error: "vmId requis" }, { status: 400 });

  const vm = await prisma.vM.findUnique({ where: { id: vmId } });
  if (!vm) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const assignment = role === "USER"
    ? await prisma.assignment.findUnique({ where: { userId_vmId: { userId, vmId } } })
    : null;
  if (!canUseVM(role as Role, vm.isInfra, Boolean(assignment))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const throttle = rateLimit(`stats:${userId}:${vmId}`, 30, 60_000);
  if (!throttle.allowed) return NextResponse.json({ error: "Trop de demandes" }, {
    status: 429,
    headers: { "Retry-After": String(throttle.retryAfter) },
  });

  let power: string = "UNKNOWN";
  let stats = null;
  let diskPartitions: any[] = [];

  try { power = await getVMPower(vm.vcenterVmId); } catch {}
  if (power === "POWERED_ON") {
    try { stats = await getVMStatsSoap(vm.vcenterVmId); } catch {}
  }
  // Disques disponibles même VM éteinte (si VMware Tools est installé et a des données en cache)
  try { diskPartitions = await getVMDiskUsage(vm.vcenterVmId); } catch {}

  // Si pas de données disk API, construire une partition synthétique depuis les données DB
  if (diskPartitions.length === 0 && vm.diskTotalGb > 0) {
    // Pas de données temps réel disponibles - retourner info statique
    // diskPartitions reste vide pour indiquer qu'il n'y a pas de données de partition
  }

  return NextResponse.json({ power, stats, diskPartitions, vm });
}
