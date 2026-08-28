"use client";
import { appDashboardDashboardVMCardStyles as s } from "@/styles";
import { useState } from "react";
import PowerToggle from "@/components/PowerToggle";
import VMStatsButton from "@/components/VMStatsButton";
import VMTagButton from "@/components/VMTagButton";

interface VM {
  id: string; name: string; vcenterVmId: string; os: string;
  vcpu: number; ramGb: number; diskCount: number; diskTotalGb: number;
  state: string; customName?: string | null;
}

export default function DashboardVMCard({ vm: initialVm }: { vm: VM }) {
  const [customName, setCustomName] = useState(initialVm.customName ?? null);

  const displayName = customName || initialVm.name;

  return (
    <div style={s.card}>
      <div style={s.vmHeader}>
        <div style={s.vmIcon}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="3" width="16" height="12" rx="2" stroke="#2563eb" strokeWidth="1.4" fill="none"/>
            <line x1="1" y1="11" x2="17" y2="11" stroke="#2563eb" strokeWidth="1" opacity=".4"/>
            <circle cx="9" cy="14" r="1" fill="#2563eb" opacity=".5"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.vmTitle}>{displayName}</div>
          {customName && <div style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{initialVm.name}</div>}
        </div>
      </div>
      <div style={s.vmSpecs}>
        {initialVm.os && <span style={s.tag}>{initialVm.os}</span>}
        <span style={s.tag}>{initialVm.vcpu} vCPU</span>
        <span style={s.tag}>{initialVm.ramGb} Go RAM</span>
        {initialVm.diskCount > 0 && <span style={s.tag}>{initialVm.diskCount} DD · {initialVm.diskTotalGb} Go</span>}
      </div>
      <div style={s.vmRef}>
        <span style={s.refLabel}>Réf.</span>
        <code style={s.code}>{initialVm.vcenterVmId}</code>
      </div>
      <div style={s.vmActions}>
        <PowerToggle vmId={initialVm.id} vmName={initialVm.name} initialState={initialVm.state as any} />
        <VMStatsButton vm={{ ...initialVm, customName }} />
        <VMTagButton
          vmId={initialVm.id}
          currentTag={customName}
          color="purple"
          scope="user"
          onSaved={(newTag) => setCustomName(newTag)}
        />
      </div>
    </div>
  );
}
