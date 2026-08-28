"use client";
import { appChangePasswordPageStyles as s } from "@/styles";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { passwordPolicyError } from "@/lib/password-policy";
import { useSiteName } from "@/lib/site-context";
import BrandIcon from "@/components/BrandIcon";

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const siteName = useSiteName();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const policyError = passwordPolicyError(password);
    if (policyError) { setError(policyError); return; }
    if (password === confirm && password.length === 0) { setError("Saisissez un mot de passe."); return; }
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setError(""); setLoading(true);
    const res = await fetch("/api/profile/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      // Se déconnecter pour forcer un nouveau token sans mustChangePassword
      await signOut({ redirect: false });
      window.location.assign("/login?changed=1");
    } else {
      const d = await res.json();
      setError(d.error ?? "Erreur lors du changement de mot de passe.");
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <BrandIcon size={32} />
          <h1 style={s.title}>{siteName}</h1>
          <p style={s.subtitle}>Changement de mot de passe requis</p>
        </div>
        <div style={s.info}>
          🔑 Un administrateur vous demande de définir un nouveau mot de passe avant de continuer.
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.field}>
            <label style={s.label}>Nouveau mot de passe</label>
            <input style={s.input} type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Min. 12 caractères" minLength={12} maxLength={256} required autoFocus />
            <small style={{ color: "var(--text2)" }}>Une minuscule, une majuscule, un chiffre et un caractère spécial sont requis.</small>
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirmer le mot de passe</label>
            <input style={s.input} type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)} placeholder="Répétez le mot de passe" minLength={12} maxLength={256} required />
            {confirm && password !== confirm && (
              <span style={{ fontSize: 12, color: "var(--red)", marginTop: 2 }}>
                Les mots de passe ne correspondent pas
              </span>
            )}
          </div>
          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? "Enregistrement…" : "Définir le nouveau mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}
