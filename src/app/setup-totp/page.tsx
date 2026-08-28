"use client";
import { appSetupTotpPageStyles as s } from "@/styles";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import QRCode from "qrcode";
import { useSiteName } from "@/lib/site-context";
import BrandIcon from "@/components/BrandIcon";

export default function SetupTotpPage() {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState("");
  const [copied, setCopied] = useState(false);
  const siteName = useSiteName();

  useEffect(() => {
    fetch("/api/totp").then(async r => {
      const data = await r.json();
      if (!r.ok || typeof data.uri !== "string" || typeof data.secret !== "string" || !data.secret) {
        throw new Error(data.error || "Configuration TOTP indisponible");
      }
      setSetup({ uri: data.uri, secret: data.secret });
      setQrData(await QRCode.toDataURL(data.uri, { width: 200, margin: 1 }));
    }).catch(() => setError("Impossible de préparer la configuration TOTP. Réessayez."));
  }, []);

  async function copySecret() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
    } catch {
      setError("Copie automatique impossible. Sélectionnez la clé manuellement.");
    }
  }

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
          <BrandIcon size={32} />
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
              <label htmlFor="totp-secret" style={{ display: "block", fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>Clé de configuration manuelle</label>
              <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
                <input id="totp-secret" value={setup.secret} readOnly spellCheck={false} autoComplete="off" aria-label="Clé secrète TOTP" style={{ minWidth: 0, flex: 1, padding: "8px 10px", border: "1px solid var(--border2)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", fontFamily: "monospace", fontSize: 13 }} />
                <button type="button" onClick={copySecret} style={{ padding: "0 12px", border: "1px solid var(--border2)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>{copied ? "Copiée" : "Copier"}</button>
              </div>
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
