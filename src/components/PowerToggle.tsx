"use client";
import { componentsPowerToggleStyles as s } from "@/styles";
import { useState, useEffect } from "react";

type State = "POWERED_ON" | "POWERED_OFF" | "SUSPENDED" | "LOADING" | "UNKNOWN";

interface Props {
  vmId: string;
  vmName?: string;
  initialState?: State;
  fetchOnMount?: boolean;
}

export default function PowerToggle({ vmId, vmName, initialState = "UNKNOWN", fetchOnMount = false }: Props) {
  const [state, setState] = useState<State>(initialState);
  const [pending, setPending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (fetchOnMount || initialState === "UNKNOWN") {
      fetch(`/api/power/${vmId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.state) setState(d.state); })
        .catch(() => setState("UNKNOWN"));
    }
  }, [vmId, fetchOnMount, initialState]);

  const isOn = state === "POWERED_ON";
  const action = isOn ? "stop" : "start";
  const actionLabel = isOn ? "Éteindre" : "Allumer";
  const actionColor = isOn ? "var(--red)" : "var(--green)";
  const actionBg = isOn ? "var(--red-light)" : "var(--green-light)";

  async function confirmAndExecute() {
    setShowConfirm(false);
    setPending(true);
    setState("LOADING");
    try {
      const res = await fetch(`/api/power/${vmId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Erreur : ${err.error ?? "Inconnue"}`);
        const current = await fetch(`/api/power/${vmId}`).then(r => r.json()).catch(() => null);
        setState(current?.state ?? initialState);
      } else {
        const data = await res.json();
        setState(data.state);
      }
    } catch {
      alert("Erreur réseau");
      setState(initialState);
    } finally {
      setPending(false);
    }
  }

  const label = state === "LOADING" ? "…"
    : state === "UNKNOWN" ? "…"
    : isOn ? "Allumée"
    : state === "SUSPENDED" ? "Suspendue"
    : "Éteinte";

  const badgeColor = isOn
    ? { bg: "var(--green-light)", color: "var(--green)" }
    : state === "LOADING" || state === "UNKNOWN"
    ? { bg: "#f5f5f4", color: "var(--text3)" }
    : { bg: "#f5f5f4", color: "var(--text2)" };

  const canToggle = !pending && state !== "SUSPENDED" && state !== "LOADING" && state !== "UNKNOWN";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ ...s.badge, background: badgeColor.bg, color: badgeColor.color }}>{label}</span>
        <button
          onClick={() => canToggle && setShowConfirm(true)}
          disabled={!canToggle}
          title={isOn ? "Éteindre la VM" : "Allumer la VM"}
          style={{
            ...s.powerBtn,
            background: isOn ? "var(--green-light)" : "var(--red-light)",
            borderColor: isOn ? "#bbf7d0" : "#fecaca",
            opacity: !canToggle ? 0.5 : 1,
            cursor: canToggle ? "pointer" : "not-allowed",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke={isOn ? "var(--green)" : "var(--red)"} strokeWidth="1.5" fill="none"/>
            <line x1="8" y1="4.5" x2="8" y2="8" stroke={isOn ? "var(--green)" : "var(--red)"} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Modal de confirmation */}
      {showConfirm && (
        <div style={s.overlay} onClick={() => setShowConfirm(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalIcon} data-action={action}>
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke={actionColor} strokeWidth="1.5" fill="none"/>
                <line x1="8" y1="4.5" x2="8" y2="8" stroke={actionColor} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 style={s.modalTitle}>{actionLabel} la VM</h3>
            {vmName && (
              <p style={s.modalVmName}>{vmName}</p>
            )}
            <p style={s.modalDesc}>
              {isOn
                ? "La machine virtuelle sera arrêtée. Les processus en cours seront interrompus."
                : "La machine virtuelle va démarrer."}
            </p>
            <div style={s.modalActions}>
              <button style={s.btnCancel} onClick={() => setShowConfirm(false)}>Annuler</button>
              <button
                style={{ ...s.btnConfirm, background: actionColor, borderColor: actionColor }}
                onClick={confirmAndExecute}
              >
                {actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
