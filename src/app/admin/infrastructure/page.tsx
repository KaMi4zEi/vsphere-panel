"use client";
import { appAdminInfrastructurePageStyles as s } from "@/styles";
import { useState, useEffect } from "react";
import PowerToggle from "@/components/PowerToggle";
import VMTagButton from "@/components/VMTagButton";
import { useSession } from "next-auth/react";

type VM = { id: string; vcenterVmId: string; name: string; customName?: string | null; os: string; vcpu: number; ramGb: number; diskCount: number; diskTotalGb: number; notes: string | null; isInfra: boolean };

export default function InfrastructurePage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [infraVMs, setInfraVMs] = useState<VM[]>([]);
  const [allVMs, setAllVMs] = useState<VM[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"az" | "za">("az");
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/vms").then(r => r.json()).then(setAllVMs);
    fetch("/api/infrastructure").then(r => r.json()).then(setInfraVMs);
  }, []);

  async function toggleInfra(vm: VM) {
    setPending(vm.id);
    const res = await fetch("/api/infrastructure", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vmId: vm.id, isInfra: !vm.isInfra }),
    });
    if (res.ok) {
      const updated = allVMs.map(v => v.id === vm.id ? { ...v, isInfra: !v.isInfra } : v);
      setAllVMs(updated);
      setInfraVMs(updated.filter(v => v.isInfra));
      setMsg(vm.isInfra ? `"${vm.name}" retiré de l'infrastructure.` : `"${vm.name}" ajouté à l'infrastructure.`);
      setTimeout(() => setMsg(""), 3000);
    }
    setPending(null);
  }

  const filter = (vms: VM[]) => {
    let r = vms.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));
    return sort === "az" ? r.sort((a, b) => a.name.localeCompare(b.name)) : r.sort((a, b) => b.name.localeCompare(a.name));
  };

  const free = allVMs.filter(v => !v.isInfra);

  return (
    <div>
      <h1 style={s.h1}>Infrastructure</h1>
      <p style={s.sub}>VMs internes non attribuées aux utilisateurs.</p>

      {msg && <div style={s.toast}>{msg}</div>}

      {/* Contrôle alimentation EN HAUT */}
      {infraVMs.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={s.h2}>Contrôle alimentation — Infrastructure</h2>
          <div style={s.powerGrid}>
            {infraVMs.map(vm => (
              <div key={vm.id} style={s.powerCard}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{vm.customName || vm.name}</div>
                  {vm.customName && <div style={{ fontSize: 11, color: "var(--text3)" }}>{vm.name}</div>}
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>{vm.vcpu} vCPU · {vm.ramGb} Go</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <VMTagButton vmId={vm.id} currentTag={vm.customName} color="orange" scope="global" />
                  <PowerToggle vmId={vm.id} vmName={vm.name} fetchOnMount={true} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestion attribution — admin seulement */}
      {isAdmin && (
        <>
          <div style={s.toolbar}>
            <input style={s.search} placeholder="Rechercher une VM…" value={search} onChange={e => setSearch(e.target.value)} />
            <button style={{ ...s.sortBtn, ...(sort === "az" ? s.sortActive : {}) }} onClick={() => setSort("az")}>A → Z</button>
            <button style={{ ...s.sortBtn, ...(sort === "za" ? s.sortActive : {}) }} onClick={() => setSort("za")}>Z → A</button>
          </div>

          <div style={s.grid}>
            <div>
              <h2 style={s.colTitle}><span style={s.dotBlue}/>Infrastructure ({infraVMs.length})</h2>
              {filter(infraVMs).length === 0 && <div style={s.empty}>Aucune VM d'infrastructure</div>}
              {filter(infraVMs).map(vm => <VMCard key={vm.id} vm={vm} infra pending={pending === vm.id} onToggle={() => toggleInfra(vm)} />)}
            </div>
            <div>
              <h2 style={s.colTitle}><span style={s.dotGray}/>Disponibles ({free.length})</h2>
              {filter(free).length === 0 && <div style={s.empty}>Toutes les VMs sont en infrastructure</div>}
              {filter(free).map(vm => <VMCard key={vm.id} vm={vm} infra={false} pending={pending === vm.id} onToggle={() => toggleInfra(vm)} />)}
            </div>
          </div>
        </>
      )}

      {!isAdmin && infraVMs.length === 0 && (
        <div style={s.empty}>Aucune VM d'infrastructure configurée.</div>
      )}
    </div>
  );
}

function VMCard({ vm, infra, pending, onToggle }: { vm: VM; infra: boolean; pending: boolean; onToggle: () => void }) {
  return (
    <div style={s.vmCard}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{vm.name}</div>
        <div style={{ fontSize: 11, color: "var(--text2)" }}>{vm.vcpu} vCPU · {vm.ramGb} Go{vm.diskCount > 0 ? ` · ${vm.diskCount} DD (${vm.diskTotalGb} Go)` : ""}</div>
        {vm.os && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{vm.os}</div>}
      </div>
      <button style={{ ...s.toggleBtn, ...(infra ? s.toggleRemove : s.toggleAdd) }} onClick={onToggle} disabled={pending}>
        {pending ? "…" : infra ? "Retirer" : "Ajouter"}
      </button>
    </div>
  );
}
