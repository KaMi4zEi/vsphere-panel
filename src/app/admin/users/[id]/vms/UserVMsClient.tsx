"use client";
import { appAdminUsersIdVmsUserVMsClientStyles as s } from "@/styles";
// src/app/admin/users/[id]/vms/UserVMsClient.tsx
import { useState } from "react";

type VM = { id: string; vcenterVmId: string; name: string; os: string; vcpu: number; ramGb: number };
type User = { id: string; username: string; email: string };

export default function UserVMsClient({
  user,
  allVMs,
  assignedIds: initialAssigned,
}: {
  user: User;
  allVMs: VM[];
  assignedIds: string[];
}) {
  const [assigned, setAssigned] = useState(new Set(initialAssigned));
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function toggle(vm: VM) {
    if (pending) return;
    setPending(vm.id);
    setMsg("");

    const isAssigned = assigned.has(vm.id);
    const method = isAssigned ? "DELETE" : "POST";

    const res = await fetch(`/api/users/${user.id}/assignments`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vmId: vm.id }),
    });

    setPending(null);
    if (res.ok) {
      setAssigned((prev) => {
        const next = new Set(prev);
        isAssigned ? next.delete(vm.id) : next.add(vm.id);
        return next;
      });
      setMsg(isAssigned ? `"${vm.name}" retiré.` : `"${vm.name}" attribué.`);
    } else {
      const data = await res.json();
      setMsg(`Erreur : ${data.error}`);
    }
  }

  const assignedVMs = allVMs.filter((v) => assigned.has(v.id));
  const freeVMs = allVMs.filter((v) => !assigned.has(v.id));

  return (
    <div>
      <div style={s.breadcrumb}>
        <a href="/admin/users" style={s.breadLink}>Utilisateurs</a>
        <span style={s.sep}>/</span>
        <span>{user.username}</span>
        <span style={s.sep}>/</span>
        <span>Machines virtuelles</span>
      </div>

      <div style={s.pageHeader}>
        <div>
          <h1 style={s.h1}>VMs de {user.username}</h1>
          <p style={s.sub}>{user.email} · {assigned.size} machine(s) attribuée(s)</p>
        </div>
      </div>

      {msg && <div style={s.toast}>{msg}</div>}

      <div style={s.grid}>
        {/* Colonne : VMs attribuées */}
        <div>
          <h2 style={s.colTitle}>
            <span style={s.dotGreen} />
            Attribuées ({assignedVMs.length})
          </h2>
          <div style={s.col}>
            {assignedVMs.length === 0 && <div style={s.empty}>Aucune VM attribuée</div>}
            {assignedVMs.map((vm) => (
              <VMCard key={vm.id} vm={vm} assigned pending={pending === vm.id} onToggle={() => toggle(vm)} />
            ))}
          </div>
        </div>

        {/* Colonne : VMs disponibles */}
        <div>
          <h2 style={s.colTitle}>
            <span style={s.dotGray} />
            Disponibles ({freeVMs.length})
          </h2>
          <div style={s.col}>
            {freeVMs.length === 0 && <div style={s.empty}>Toutes les VMs sont attribuées</div>}
            {freeVMs.map((vm) => (
              <VMCard key={vm.id} vm={vm} assigned={false} pending={pending === vm.id} onToggle={() => toggle(vm)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VMCard({ vm, assigned, pending, onToggle }: {
  vm: VM; assigned: boolean; pending: boolean; onToggle: () => void;
}) {
  return (
    <div style={s.vmCard}>
      <div>
        <div style={s.vmName}>{vm.name}</div>
        <div style={s.vmMeta}>
          {vm.vcenterVmId} · {vm.vcpu} vCPU · {vm.ramGb} Go RAM
          {vm.os && ` · ${vm.os}`}
        </div>
      </div>
      <button
        style={{ ...s.toggleBtn, ...(assigned ? s.toggleRemove : s.toggleAdd) }}
        onClick={onToggle}
        disabled={pending}
      >
        {pending ? "…" : assigned ? "Retirer" : "Attribuer"}
      </button>
    </div>
  );
}
