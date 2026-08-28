"use client";
import { appSetupTotpPageStyles as s } from "@/styles";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import QRCode from "qrcode";

export default function SetupTotpPage() {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [siteName, setSiteName] = useState("vSphere Panel");
  const [qrData, setQrData] = useState("");

  useEffect(() => {
    fetch("/api/identity").then(r => r.json()).then(d => { if (d.siteName) setSiteName(d.siteName); });
    fetch("/api/totp").then(async r => {
      const data = await r.json();
      if (!r.ok || !data.uri) throw new Error(data.error || "Configuration TOTP indisponible");
      setSetup(data);
      setQrData(await QRCode.toDataURL(data.uri, { width: 200, margin: 1 }));
    }).catch(() => setError("Impossible de préparer la configuration TOTP. Réessayez."));
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError("Le code doit faire 6 chiffres"); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setLoading(false);
    if (res.ok) {
      // Se déconnecter pour forcer un nouveau token avec totpEnabled=true
      await signOut({ redirect: false });
      window.location.assign("/login?totp=configured");
    } else {
      const d = await res.json();
      setError(d.error ?? "Code invalide — vérifiez l'heure de votre appareil et réessayez.");
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#2563eb"/>
            <rect x="5" y="9" width="18" height="12" rx="2" stroke="white" strokeWidth="1.5" fill="none"/>
            <circle cx="9" cy="15" r="2" fill="white" opacity=".8"/>
            <line x1="13" y1="13" x2="21" y2="13" stroke="white" strokeWidth="1" strokeLinecap="round" opacity=".6"/>
            <line x1="13" y1="15" x2="21" y2="15" stroke="white" strokeWidth="1" strokeLinecap="round" opacity=".6"/>
          </svg>
          <h1 style={s.title}>{siteName}</h1>
          <p style={s.subtitle}>Configuration de l'authentification à deux facteurs</p>
        </div>

        <div style={s.info}>
          🔒 Votre compte requiert la configuration du TOTP pour sécuriser vos accès.
        </div>

        {setup ? (
          <>
            <p style={s.step}><strong>1.</strong> Scannez ce QR code avec Google Authenticator, Aegis ou toute app TOTP.</p>
            <div style={{ textAlign: "center", margin: "16px 0" }}>
              {qrData && <img
                src={qrData}
                alt="QR TOTP"
                style={{ borderRadius: 8, border: "1px solid var(--border)" }}
              />}
            </div>
            <div style={{ margin: "12px 0 18px", padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface2)" }}>
              <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>Clé de configuration manuelle</div>
              <code style={{ display: "block", overflowWrap: "anywhere", fontSize: 13, userSelect: "all" }}>{setup.secret}</code>
            </div>
            <p style={s.step}><strong>2.</strong> Entrez le code à 6 chiffres affiché dans votre application.</p>
            <form onSubmit={confirm} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {error && <div style={s.errorBox}>{error}</div>}
              <input
                style={s.input}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
              <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
                {loading ? "Vérification…" : "Activer le TOTP"}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "24px 0", color: error ? "var(--red)" : "var(--text2)" }}>{error || "Chargement…"}</div>
        )}
      </div>
    </div>
  );
}
