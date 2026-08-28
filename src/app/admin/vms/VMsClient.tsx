"use client";
import { appAdminVmsVMsClientStyles as s } from "@/styles";
import { useState, useCallback } from "react";
import VMStatsButton from "@/components/VMStatsButton";
import PowerToggle from "@/components/PowerToggle";
import VMTagButton from "@/components/VMTagButton";

type Assignment = { user: { id: string; username: string } };
type VM = { id: string; vcenterVmId: string; name: string; customName?: string | null; os: string; vcpu: number; ramGb: number; diskCount: number; diskTotalGb: number; notes: string | null; isInfra: boolean; assignments: Assignment[] };

export default function VMsClient({ initialVMs, actorRole }: { initialVMs: VM[]; actorRole: string }) {
  const isAdmin = actorRole === "ADMIN";
  const [vms, setVMs] = useState(initialVMs);
  const [showModal, setShowModal] = useState(false);
  const [vcVMs, setVcVMs] = useState<{vm: string; name: string; cpu_count: number; memory_size_MiB: number; imported: boolean}[]>([]);
  const [vcLoading, setVcLoading] = useState(false);
  const [vcSearch, setVcSearch] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [assignModal, setAssignModal] = useState<{ vmId: string; vmName: string } | null>(null);
  const [assignUsers, setAssignUsers] = useState<{id: string; username: string; email: string; role: string}[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  // State local pour les tags (mis à jour sans reload)
  const [vmTags, setVmTags] = useState<Record<string, string | null>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"az" | "za">("az");

  async function openAddModal() {
    setShowModal(true);
    setVcLoading(true);
    setVcVMs([]);
    setVcSearch("");
    try {
      const res = await fetch("/api/vms/vcenter-list");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setVcVMs(data);
      }
    } catch {}
    setVcLoading(false);
  }

  async function importVM(vcVm: {vm: string; name: string; cpu_count: number; memory_size_MiB: number}) {
    setImporting(vcVm.vm);
    try {
      const res = await fetch("/api/vms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vcenterVmId: vcVm.vm, name: vcVm.name, vcpu: vcVm.cpu_count, ramGb: Math.round(vcVm.memory_size_MiB / 1024) }),
      });
      if (res.ok) {
        const newVm = await res.json();
        setVMs(prev => [...prev, { ...newVm, assignments: [] }].sort((a, b) => a.name.localeCompare(b.name)));
        setVcVMs(prev => prev.map(v => v.vm === vcVm.vm ? { ...v, imported: true } : v));
        setSyncMsg(`"${vcVm.name}" importée avec succès.`);
      }
    } catch {}
    setImporting(null);
  }

  async function openAssignModal(vmId: string, vmName: string) {
    setAssignModal({ vmId, vmName });
    setAssignSearch("");
    setAssignLoading(true);
    const res = await fetch(`/api/vms/${vmId}/assignments`);
    if (res.ok) {
      const data = await res.json();
      setAssignUsers(data.allUsers);
      setAssignedIds(new Set(data.assignments.map((a: any) => a.userId)));
    }
    setAssignLoading(false);
  }

  async function toggleAssignment(userId: string) {
    if (!assignModal) return;
    const isAssigned = assignedIds.has(userId);
    const method = isAssigned ? "DELETE" : "POST";
    const res = await fetch(`/api/vms/${assignModal.vmId}/assignments`, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setAssignedIds(prev => {
        const next = new Set(prev);
        isAssigned ? next.delete(userId) : next.add(userId);
        return next;
      });
      // Mettre à jour la liste des assignments dans la VM
      setVMs(prev => prev.map(v => {
        if (v.id !== assignModal.vmId) return v;
        if (isAssigned) {
          return { ...v, assignments: v.assignments.filter(a => a.user.id !== userId) };
        } else {
          const user = assignUsers.find(u => u.id === userId);
          if (!user) return v;
          return { ...v, assignments: [...v.assignments, { user: { id: user.id, username: user.username } }] };
        }
      }));
    }
  }

  const handleTagSaved = useCallback((vmId: string, tag: string | null) => {
    setVmTags(prev => ({ ...prev, [vmId]: tag }));
    setVMs(prev => prev.map(v => v.id === vmId ? { ...v, customName: tag } : v));
  }, []);

  async function refreshConfig() {
    setRefreshing(true); setSyncMsg("");
    const res = await fetch("/api/vms/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const data = await res.json();
    setRefreshing(false);
    if (res.ok) { setSyncMsg(`Config actualisée — ${data.refreshed} VM(s) mises à jour.`); window.location.reload(); }
    else setSyncMsg(`Erreur : ${data.error ?? "inconnue"}`);
  }

  async function syncVMs() {
    setSyncing(true); setSyncMsg("");
    let res = await fetch("/api/vms/sync", { method: "POST" });
    let data = await res.json();
    if (res.status === 409 && data.requiresConfirmation && confirm(`${data.deleteCount} VM(s) seraient supprimées. Confirmer ?`)) {
      res = await fetch("/api/vms/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmDeletes: true }) });
      data = await res.json();
    }
    setSyncing(false);
    if (res.ok) { setSyncMsg(`Sync OK — ${data.added} ajoutée(s), ${data.updated} mise(s) à jour, ${data.removed} supprimée(s)`); window.location.reload(); }
    else setSyncMsg(`Erreur : ${data.error ?? "inconnue"}`);
  }

  async function deleteVM(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" du panel ? (La VM reste dans vCenter)`)) return;
    const res = await fetch("/api/vms", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vmId: id }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSyncMsg(`Erreur : ${data.error ?? "suppression impossible"}`);
      return;
    }
    setVMs(prev => prev.filter(v => v.id !== id));
    setSyncMsg(`"${name}" a été retirée du panel.`);
  }


  const filtered = vms
    .filter(v => {
      if (!isAdmin && v.isInfra) return false; // Modérateur ne voit pas les VMs infra
      const tag = vmTags[v.id] !== undefined ? vmTags[v.id] : v.customName;
    return (
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.vcenterVmId.toLowerCase().includes(search.toLowerCase()) ||
      v.os.toLowerCase().includes(search.toLowerCase()) ||
      (tag && tag.toLowerCase().includes(search.toLowerCase()))
    );
    })
    .sort((a, b) => sort === "az" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

  return (
    <div className="vms-page">
      <div className="vms-page-header" style={s.pageHeader}>
        <div><h1 style={s.h1}>Machines virtuelles</h1><p style={s.sub}>{vms.length} VM(s)</p></div>
        <div className="vms-header-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isAdmin && <button style={s.btnSecondary} onClick={refreshConfig} disabled={refreshing}>{refreshing ? "Actualisation…" : "↻ Actualiser config"}</button>}
          {isAdmin && <button style={s.btnSecondary} onClick={syncVMs} disabled={syncing}>{syncing ? "Sync…" : "↻ Synchroniser"}</button>}
          {isAdmin && <button style={s.btnPrimary} onClick={openAddModal}>+ Importer</button>}
        </div>
      </div>

      {syncMsg && <div style={{ ...s.toast, ...(syncMsg.startsWith("Erreur") ? s.toastError : {}) }}>{syncMsg}</div>}

      <div className="vms-toolbar" style={s.toolbar}>
        <input style={s.search} placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        <button style={{ ...s.sortBtn, ...(sort === "az" ? s.sortActive : {}) }} onClick={() => setSort("az")}>A → Z</button>
        <button style={{ ...s.sortBtn, ...(sort === "za" ? s.sortActive : {}) }} onClick={() => setSort("za")}>Z → A</button>
      </div>

      <div className="vms-table-card" style={s.card}>
        <table className="vms-table" style={s.table}>
          <thead><tr><Th>Nom</Th><Th>ID Machine</Th><Th>OS</Th><Th>Config</Th><Th>Stockage</Th><Th>Attribuée</Th><Th>Tag</Th><Th>Statut</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {filtered.map(vm => (
              <tr key={vm.id}>
                <Td label="Nom">
                  <div style={{ fontWeight: 600 }}>
                    {(vmTags[vm.id] !== undefined ? vmTags[vm.id] : vm.customName) || vm.name}
                  </div>
                  {(vmTags[vm.id] !== undefined ? vmTags[vm.id] : vm.customName) &&
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{vm.name}</div>}
                  {vm.isInfra && <span style={s.badgeInfra}>Infrastructure</span>}
                  {vm.notes && <div style={{ fontSize: 11, color: "var(--text2)" }}>{vm.notes}</div>}
                </Td>
                <Td label="ID Machine"><code style={s.code}>{vm.vcenterVmId}</code></Td>
                <Td label="OS" style={{ color: "var(--text2)", fontSize: 12 }}>{vm.os || "—"}</Td>
                <Td label="Configuration" style={{ color: "var(--text2)" }}>{vm.vcpu} vCPU · {vm.ramGb} Go</Td>
                <Td label="Stockage" style={{ color: "var(--text2)", fontSize: 12 }}>{vm.diskCount > 0 ? `${vm.diskCount} DD · ${vm.diskTotalGb} Go` : "—"}</Td>

                <Td label="Attribuée">
                  {vm.assignments.length === 0
                    ? <span style={s.badgeGray}>Non attribuée</span>
                    : vm.assignments.map(a => (
                      isAdmin
                        ? <a key={a.user.id} href={`/admin/users/${a.user.id}/vms`} style={s.badgeBlue}>{a.user.username}</a>
                        : <span key={a.user.id} style={s.badgeBlue}>{a.user.username}</span>
                    ))
                  }
                </Td>
                <Td label="Tag">
                  <VMTagButton
                    vmId={vm.id}
                    currentTag={vmTags[vm.id] !== undefined ? vmTags[vm.id] : vm.customName}
                    color="orange"
                    scope="global"
                    onSaved={(tag) => handleTagSaved(vm.id, tag)}
                  />
                </Td>
                <Td label="Statut"><PowerToggle vmId={vm.id} vmName={vm.name} initialState="UNKNOWN" /></Td>
                <Td label="Actions">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <VMStatsButton vm={vm as any} />
                    <button style={s.btnSm} onClick={() => openAssignModal(vm.id, vm.name)}>Attribution</button>
                    {isAdmin && <button style={{ ...s.btnSm, ...s.btnDanger }} onClick={() => deleteVM(vm.id, vm.name)}>Supprimer</button>}
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9} style={{ ...s.td, textAlign: "center", color: "var(--text3)", padding: 32 }}>Aucune VM — cliquez sur "Synchroniser"</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={s.modalOverlay} onClick={() => setShowModal(false)}>
          <div className="vms-modal" role="dialog" aria-modal="true" style={{ ...s.modal, width: 560 }} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Importer</h2>
            <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12 }}>
              Sélectionnez les VMs à importer dans le panel. Les VMs déjà présentes ne sont pas listées.
            </p>
            <input
              style={{ ...s.input, marginBottom: 12 }}
              placeholder="Rechercher…"
              value={vcSearch}
              onChange={e => setVcSearch(e.target.value)}
            />
            {vcLoading ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text2)", fontSize: 13 }}>Connexion au serveur de virtualisation…</div>
            ) : vcVMs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text3)", fontSize: 13 }}>
                Impossible de récupérer les machines virtuelles. Vérifiez la connexion.
              </div>
            ) : (
              <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {vcVMs
                  .filter(v => v.name.toLowerCase().includes(vcSearch.toLowerCase()))
                  .map(v => (
                    <div key={v.vm} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: v.imported ? "var(--surface2)" : "var(--surface)", borderRadius: "var(--radius)", border: `1px solid ${v.imported ? "var(--border)" : "var(--border2)"}`, opacity: v.imported ? 0.6 : 1 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text2)" }}>{v.vm} · {v.cpu_count} vCPU · {Math.round(v.memory_size_MiB / 1024)} Go</div>
                      </div>
                      {v.imported ? (
                        <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 500, flexShrink: 0 }}>✓ Importée</span>
                      ) : (
                        <button
                          style={{ ...s.btnPrimary, padding: "5px 12px", fontSize: 12, flexShrink: 0 }}
                          onClick={() => importVM(v)}
                          disabled={importing === v.vm}
                        >
                          {importing === v.vm ? "…" : "Ajouter"}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button style={s.btnSm} onClick={() => setShowModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal d'attribution */}
      {assignModal && (
        <div style={s.overlay} onClick={() => setAssignModal(null)}>
          <div className="vms-modal" role="dialog" aria-modal="true" style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Attribuer — {assignModal.vmName}</h2>
              <button style={s.closeBtn} onClick={() => setAssignModal(null)}>✕</button>
            </div>
            {assignLoading ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text2)", fontSize: 13 }}>Chargement…</div>
            ) : (
              <>
              <input
                style={{ ...s.searchInput, marginBottom: 10 }}
                placeholder="Rechercher un utilisateur…"
                value={assignSearch}
                onChange={e => setAssignSearch(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {assignUsers.filter(u =>
                  u.username.toLowerCase().includes(assignSearch.toLowerCase()) ||
                  u.email.toLowerCase().includes(assignSearch.toLowerCase())
                ).map(u => {
                  const assigned = assignedIds.has(u.id);
                  return (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: assigned ? "var(--blue-light)" : "var(--surface2)", borderRadius: "var(--radius)", border: `1px solid ${assigned ? "var(--blue)" : "var(--border)"}` }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</div>
                        <div style={{ fontSize: 11, color: "var(--text2)" }}>{u.email} · {u.role}</div>
                      </div>
                      <button
                        style={{ ...s.btnSm, ...(assigned ? s.btnDanger : { borderColor: "var(--blue)", color: "var(--blue)" }), flexShrink: 0 }}
                        onClick={() => toggleAssignment(u.id)}
                      >
                        {assigned ? "Retirer" : "Attribuer"}
                      </button>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th style={s.th}>{children}</th>; }
function Td({ children, style, label }: { children: React.ReactNode; style?: React.CSSProperties; label?: string }) {
  return <td data-label={label} style={{ ...s.td, ...style }}>{children}</td>;
}
