"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appLoginPageStyles as s } from "@/styles";

export default function SetupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Impossible de terminer la configuration."); return; }
      router.replace("/login?setup=completed");
      router.refresh();
    } catch {
      setError("Le serveur est injoignable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.logoWrap}>
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#2563eb" />
              <rect x="5" y="9" width="18" height="12" rx="2" stroke="white" strokeWidth="1.5" />
              <circle cx="9" cy="15" r="2" fill="white" opacity=".8" />
            </svg>
          </div>
          <h1 style={s.title}>Configuration initiale</h1>
          <p style={s.subtitle}>Créez le premier compte administrateur</p>
        </div>
        <form onSubmit={submit} style={s.form}>
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.field}>
            <label style={s.label} htmlFor="setup-username">Nom d’utilisateur</label>
            <input id="setup-username" style={s.input} value={username} onChange={event => setUsername(event.target.value)} minLength={2} maxLength={80} autoComplete="username" required autoFocus />
          </div>
          <div style={s.field}>
            <label style={s.label} htmlFor="setup-email">Email</label>
            <input id="setup-email" style={s.input} type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={320} autoComplete="email" required />
          </div>
          <div style={s.field}>
            <label style={s.label} htmlFor="setup-password">Mot de passe</label>
            <input id="setup-password" style={s.input} type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={256} autoComplete="new-password" required />
            <small>12 caractères minimum avec minuscule, majuscule, chiffre et caractère spécial.</small>
          </div>
          <div style={s.field}>
            <label style={s.label} htmlFor="setup-confirmation">Confirmer le mot de passe</label>
            <input id="setup-confirmation" style={s.input} type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={12} maxLength={256} autoComplete="new-password" required />
          </div>
          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? "Création…" : "Créer l’administrateur"}
          </button>
        </form>
      </div>
    </div>
  );
}
