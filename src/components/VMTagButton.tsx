"use client";
import { componentsVMTagButtonStyles as s } from "@/styles";
import { useState } from "react";

interface Props {
  vmId: string;
  currentTag?: string | null;
  color?: "purple" | "orange";
  scope?: "user" | "global"; // "user" = assignment, "global" = VM
  onSaved?: (tag: string | null) => void;
}

export default function VMTagButton({ vmId, currentTag, color = "purple", scope, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentTag ?? "");
  const [saving, setSaving] = useState(false);

  const bg = color === "orange" ? "#fef3c7" : "#f3f0ff";
  const fg = color === "orange" ? "#92400e" : "#7c3aed";
  const border = color === "orange" ? "#fde68a" : "#ddd6fe";

  async function save() {
    setSaving(true);
    const res = await fetch("/api/vms/tag", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vmId, customName: value.trim() || null, scope }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      onSaved?.(d.customName);
      setOpen(false);
    }
  }

  const displayLabel = currentTag || "Tag";

  return (
    <>
      <button
        onClick={() => { setValue(currentTag ?? ""); setOpen(true); }}
        title={currentTag ? `Tag : ${currentTag}` : "Ajouter un tag"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 9px", borderRadius: 99, flexShrink: 0,
          background: currentTag ? bg : "transparent",
          color: currentTag ? fg : "var(--text3)",
          border: `1px solid ${currentTag ? border : "var(--border2)"}`,
          cursor: "pointer", fontSize: 11, fontWeight: 600,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M1 6.5V10h3.5l5-5L6 1.5 1 6.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
          <circle cx="9" cy="3" r="1" fill="currentColor"/>
        </svg>
        Tag
      </button>

      {open && (
        <div style={s.overlay} onClick={() => setOpen(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={s.title}>Nom personnalisé</h3>
            <p style={s.desc}>Ce nom s'affichera à la place du nom technique de la VM.</p>
            <input
              style={s.input}
              placeholder="Ex: Serveur Web Production"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && save()}
              autoFocus
              maxLength={64}
            />
            {value && (
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>
                Aperçu : <span style={{ fontWeight: 600, color: fg }}>{value}</span>
              </div>
            )}
            <div style={s.actions}>
              {currentTag && (
                <button style={{ ...s.btnDanger }} onClick={() => { setValue(""); }}>
                  Effacer le tag
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button style={s.btnCancel} onClick={() => setOpen(false)}>Annuler</button>
              <button style={{ ...s.btnSave, background: fg }} onClick={save} disabled={saving}>
                {saving ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
