"use client";
import { appLoginPageStyles as s } from "@/styles";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSiteName } from "@/lib/site-context";
import BrandIcon from "@/components/BrandIcon";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const successMsg = searchParams.get("changed") === "1"
    ? "✅ Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe."
    : searchParams.get("totp") === "configured"
    ? "✅ TOTP configuré. Connectez-vous avec votre code TOTP."
    : searchParams.get("setup") === "completed"
    ? "Configuration terminée. Connectez-vous avec votre compte administrateur."
    : null;
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const siteName = useSiteName();

  useEffect(() => {
    fetch("/api/setup", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.setupRequired) router.replace("/setup"); })
      .catch(() => {});
  }, [router]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    // Step 1: Check credentials + whether TOTP is needed
    const check = await fetch("/api/auth/check-totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()).catch(() => ({ valid: false }));

    if (!check.valid) {
      setLoading(false);
      setError("Email ou mot de passe incorrect");
      return;
    }

    if (check.needsTotp) {
      // Show TOTP step — don't call signIn yet
      setLoading(false);
      setStep("totp");
      return;
    }

    // No TOTP needed — sign in directly
    const res = await signIn("credentials", { email, password, totpCode: "", redirect: false });
    setLoading(false);
    if (!res?.error) { router.push("/dashboard"); return; }
    setError("Erreur de connexion, veuillez réessayer.");
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    if (totpCode.length !== 6) { setError("Le code doit faire 6 chiffres"); return; }
    setError(""); setLoading(true);

    const res = await signIn("credentials", {
      email, password, totpCode,
      redirect: false,
    });
    setLoading(false);

    if (!res?.error) { router.push("/dashboard"); return; }
    setError("Code TOTP invalide ou expiré. Réessayez.");
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.logoWrap}>
            <BrandIcon size={32} />
          </div>
          <h1 style={s.title}>{siteName}</h1>
          <p style={s.subtitle}>{step === "totp" ? "Code d'authentification" : "Connectez-vous à votre espace"}</p>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentials} style={s.form}>
            {successMsg && <div style={s.successBox}>{successMsg}</div>}
            {error && <div style={s.errorBox}>{error}</div>}
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" required autoFocus />
            </div>
            <div style={s.field}>
              <label style={s.label}>Mot de passe</label>
              <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? "Vérification…" : "Se connecter"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotp} style={s.form}>
            {successMsg && <div style={s.successBox}>{successMsg}</div>}
            {error && <div style={s.errorBox}>{error}</div>}
            <p style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", margin: 0 }}>
              Entrez le code à 6 chiffres de votre application d'authentification.
            </p>
            <div style={s.field}>
              <label style={s.label}>Code TOTP</label>
              <input
                style={{ ...s.input, textAlign: "center", fontSize: 22, fontWeight: 700, letterSpacing: 8 }}
                type="text" inputMode="numeric" maxLength={6}
                value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000" required autoFocus
              />
            </div>
            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? "Vérification…" : "Vérifier"}
            </button>
            <button type="button" style={s.btnSecondary} onClick={() => { setStep("credentials"); setError(""); setTotpCode(""); }}>
              ← Retour
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
