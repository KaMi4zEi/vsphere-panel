import { appDashboardPageStyles as s } from "@/styles";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getVMPower, VcPowerState } from "@/lib/vcenter";
import DashboardVMCard from "@/app/dashboard/DashboardVMCard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session!.user as any).id;
  const assignments = await prisma.assignment.findMany({
    where: session.user.role === "ADMIN" ? { userId } : { userId, vm: { isInfra: false } },
    include: { vm: true },
    orderBy: { vm: { name: "asc" } },
  });

  const vmsWithState = await Promise.all(
    assignments.map(async (a) => {
      let state: VcPowerState = "POWERED_OFF";
      try { state = await getVMPower(a.vm.vcenterVmId); } catch {}
      return { ...a.vm, state, customName: a.customName ?? null };
    })
  );

  return (
    <div>
      <h1 style={s.h1}>Mes machines</h1>
      <p style={s.sub}>
        {vmsWithState.length === 0
          ? "Aucune machine ne vous a été attribuée."
          : `${vmsWithState.length} machine(s) · ${vmsWithState.filter(v => v.state === "POWERED_ON").length} allumée(s)`}
      </p>

      {vmsWithState.length === 0 ? (
        <div style={s.empty}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.3, marginBottom: 12 }}>
            <rect x="3" y="7" width="26" height="18" rx="3" stroke="#888" strokeWidth="1.5" fill="none"/>
            <circle cx="9" cy="16" r="3" fill="#888" opacity=".5"/>
            <line x1="14" y1="13" x2="27" y2="13" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="14" y1="16" x2="27" y2="16" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="14" y1="19" x2="22" y2="19" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: 14, color: "var(--text2)", maxWidth: 340, textAlign: "center" }}>
            Contactez l'administrateur pour obtenir l'accès à une machine virtuelle.
          </p>
        </div>
      ) : (
        <div style={s.grid}>
          {vmsWithState.map(vm => (
            <DashboardVMCard key={vm.id} vm={vm} />
          ))}
        </div>
      )}
    </div>
  );
}
