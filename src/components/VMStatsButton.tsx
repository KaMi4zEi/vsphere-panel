"use client";
import { componentsVMStatsButtonStyles as s } from "@/styles";
import { useState } from "react";

type Stats = {
  cpuUsagePct: number; cpuUsageMhz: number; cpuCapacityMhz: number;
  memUsagePct: number; memUsageMb: number; memCapacityMb: number;
  diskTotalGb?: number;
} | null;

type DiskPartition = {
  path: string; capacity: number; freeSpace: number;
  filesystem: string; usedPct: number;
};

type VM = {
  id: string; name: string; vcenterVmId: string; os?: string;
  vcpu: number; ramGb: number; diskCount?: number; diskTotalGb?: number;
  customName?: string | null;
};

export default function VMStatsButton({ vm }: { vm: VM }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ power: string; stats: Stats; diskPartitions: DiskPartition[]; vm: VM } | null>(null);
  const [loading, setLoading] = useState(false);

  async function openModal() {
    setOpen(true); setLoading(true); setData(null);
    try {
      const res = await fetch(`/api/stats?vmId=${vm.id}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  const powerLabel = data?.power === "POWERED_ON" ? "Allumée"
    : data?.power === "POWERED_OFF" ? "Éteinte"
    : data?.power === "SUSPENDED" ? "Suspendue" : "—";
  const powerColor = data?.power === "POWERED_ON" ? "var(--green)" : "var(--text2)";
  const isOn = data?.power === "POWERED_ON";
  const disks = data?.diskPartitions ?? [];

  return (
    <>
      <button style={s.btn} onClick={openModal} title="Statistiques">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="8" width="3" height="6" rx="1" fill="currentColor" opacity=".6"/>
          <rect x="6" y="5" width="3" height="9" rx="1" fill="currentColor" opacity=".8"/>
          <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor"/>
        </svg>
        Stats
      </button>

      {open && (
        <div style={s.overlay} onClick={() => setOpen(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{vm.customName || vm.name}</h3>
              <button style={s.closeBtn} onClick={() => setOpen(false)}>✕</button>
            </div>

            {loading ? (
              <div style={s.center}>Chargement…</div>
            ) : !data ? (
              <div style={s.center}>Erreur de chargement.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Configuration */}
                <div style={s.section}>
                  <div style={s.sectionTitle}>Configuration</div>
                  <div style={s.grid2}>
                    <StatCard label="État" value={powerLabel} color={powerColor} />
                    <StatCard label="vCPU" value={`${vm.vcpu} cœur${vm.vcpu > 1 ? "s" : ""}`} />
                    <StatCard label="RAM" value={`${vm.ramGb} Go`} />
                    {vm.os && <StatCard label="Système" value={vm.os} />}
                    {(vm.diskTotalGb ?? 0) > 0 && (
                      <StatCard label="Stockage total" value={`${Math.round((vm.diskTotalGb ?? 0) * 10) / 10} Go`} />
                    )}
                  </div>
                </div>

                {/* Stats CPU/RAM — uniquement si allumée */}
                {isOn && data.stats && (
                  <div style={s.section}>
                    <div style={s.sectionTitle}>Utilisation temps réel</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {data.stats.cpuUsagePct >= 0 && (
                        <MetricBar label="CPU" pct={data.stats.cpuUsagePct}
                          detail={data.stats.cpuCapacityMhz > 0
                            ? `${data.stats.cpuUsageMhz} MHz / ${data.stats.cpuCapacityMhz} MHz`
                            : `${data.stats.cpuUsagePct}% d'utilisation`}
                          color={data.stats.cpuUsagePct > 80 ? "var(--red)" : data.stats.cpuUsagePct > 60 ? "#f59e0b" : "var(--blue)"} />
                      )}
                      {data.stats.memCapacityMb > 0 && (
                        <MetricBar label="Mémoire" pct={data.stats.memUsagePct}
                          detail={`${(data.stats.memUsageMb / 1024).toFixed(1)} Go / ${(data.stats.memCapacityMb / 1024).toFixed(1)} Go`}
                          color={data.stats.memUsagePct > 80 ? "var(--red)" : data.stats.memUsagePct > 60 ? "#f59e0b" : "var(--green)"} />
                      )}
                    </div>
                  </div>
                )}

                {isOn && !data.stats && (
                  <div style={s.infoBox}>
                    ℹ️ Les statistiques CPU et RAM ne sont pas disponibles pour cette VM.
                  </div>
                )}

                {!isOn && (
                  <div style={s.infoBox}>
                    ℹ️ La VM est {powerLabel.toLowerCase()} — CPU et RAM indisponibles.
                  </div>
                )}

                {/* Partitions disque — disponibles allumée ET éteinte */}
                {disks.length > 0 ? (
                  <div style={s.section}>
                    <div style={s.sectionTitle}>
                      Utilisation disque{!isOn ? " (dernières données connues)" : ""}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {disks.map(p => {
                        const usedGb = Math.round((p.capacity - p.freeSpace) / (1024 ** 3) * 10) / 10;
                        const totalGb = Math.round(p.capacity / (1024 ** 3) * 10) / 10;
                        const freeGb = Math.round(p.freeSpace / (1024 ** 3) * 10) / 10;
                        return (
                          <MetricBar key={p.path} label={p.path} pct={p.usedPct}
                            detail={`${usedGb} Go utilisés / ${totalGb} Go — ${freeGb} Go libres (${p.filesystem})`}
                            color={p.usedPct > 90 ? "var(--red)" : p.usedPct > 75 ? "#f59e0b" : "var(--blue)"} />
                        );
                      })}
                    </div>
                  </div>
                ) : (vm.diskTotalGb ?? 0) > 0 ? (
                  <div style={s.section}>
                    <div style={s.sectionTitle}>Stockage{!isOn ? " (données statiques)" : ""}</div>
                    <div style={s.grid2}>
                      <StatCard label="Disques" value={`${vm.diskCount ?? 0} DD`} />
                      <StatCard label="Capacité totale" value={`${Math.round((vm.diskTotalGb ?? 0) * 10) / 10} Go`} />
                    </div>
                    {!isOn && (
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                        Les données de partition ne sont pas disponibles — VMware Tools peut ne pas avoir de données en cache.
                      </div>
                    )}
                  </div>
                ) : null}

              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface2)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color ?? "var(--text)", wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function MetricBar({ label, pct, detail, color }: { label: string; pct: number; detail: string; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 10, background: "var(--surface2)", borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: 11, color: "var(--text3)" }}>{detail}</div>
    </div>
  );
}
