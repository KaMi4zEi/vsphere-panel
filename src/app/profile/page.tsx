"use client";
import { appProfilePageStyles as s } from "@/styles";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import LogsClient from "@/app/admin/logs/LogsClient";
import QRCode from "qrcode";

type Profile = { id: string; username: string; email: string; role: string; createdAt: string; totpEnabled: boolean; totpDisabled: boolean; totpForced: boolean; _count: { assignments: number; logs: number } };
type Notif = { infraStoppedAlert: boolean; infraStartedAlert: boolean; vmPowerAlert: boolean };

export default function ProfilePage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const isModerator = (session?.user as any)?.role === "MODERATOR";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"info" | "password" | "totp" | "notifications" | "logs">("info");
  const [currentPwd, setCurrentPwd] = useState(""); const [newPwd, setNewPwd] = useState(""); const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false); const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState(""); const [totpMsg, setTotpMsg] = useState("");
  const [totpQr, setTotpQr] = useState("");
  const [notif, setNotif] = useState<Notif>({ infraStoppedAlert: false, infraStartedAlert: false, vmPowerAlert: false });
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifError, setNotifError] = useState("");

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(setProfile);
    fetch("/api/notifications").then(r => r.json()).then(setNotif);
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setPwdMsg(null);
    if (newPwd !== confirmPwd) { setPwdMsg({ type: "err", text: "Les mots de passe ne correspondent pas" }); return; }
    setPwdLoading(true);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }) });
    const data = await res.json(); setPwdLoading(false);
    setPwdMsg(res.ok ? { type: "ok", text: data.message } : { type: "err", text: data.error });
    if (res.ok) { setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }
  }

  async function setupTotp() {
    const res = await fetch("/api/totp");
    const data = await res.json();
    setTotpSetup(data);
    if (data.uri) setTotpQr(await QRCode.toDataURL(data.uri, { width: 200, margin: 1 }));
  }

  async function confirmTotp(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: totpCode }) });
    const data = await res.json();
    if (res.ok) { setTotpMsg("TOTP activé !"); setTotpSetup(null); setTotpCode(""); if (profile) setProfile({ ...profile, totpEnabled: true }); }
    else setTotpMsg(data.error);
  }

  async function disableTotp() {
    if (!confirm("Désactiver le TOTP ?")) return;
    const res = await fetch("/api/totp", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTotpMsg(data.error ?? "Impossible de désactiver le TOTP.");
      return;
    }
    if (profile) setProfile({ ...profile, totpEnabled: false, totpDisabled: false });
    setTotpMsg("TOTP désactivé.");
  }

  async function saveNotif() {
    setNotifError("");
    const res = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notif) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotifError(data.error ?? "Impossible d'enregistrer les préférences.");
      return;
    }
    setNotifSaved(true); setTimeout(() => setNotifSaved(false), 3000);
  }

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "info", label: "Informations" },
    { id: "password", label: "Mot de passe" },
    { id: "totp", label: "Authentification 2FA" },
    { id: "notifications", label: "Notifications" },
    { id: "logs", label: "Historique" },
  ];

  return (
    <div className="profile-page" style={s.page}>
      <div className="profile-container" style={s.container}>
        <a href={isAdmin || isModerator ? "/admin" : "/dashboard"} style={s.back}>← Retour</a>
        <div className="profile-header" style={s.profileHeader}>
          <div style={s.avatar}>{(session?.user?.name ?? "?")[0].toUpperCase()}</div>
          <div>
            <h1 style={s.h1}>{session?.user?.name}</h1>
            <p style={s.email}>{session?.user?.email}</p>
            <span style={isAdmin ? s.badgeAdmin : s.badgeUser}>{isAdmin ? "Administrateur" : isModerator ? "Modérateur" : "Utilisateur"}</span>
          </div>
        </div>

        {profile && (
          <div className="profile-stats" style={s.statsRow}>
            <div style={s.stat}><div style={s.statVal}>{profile._count.assignments}</div><div style={s.statLbl}>VM(s) attribuée(s)</div></div>
            <div style={s.stat}><div style={s.statVal}>{profile._count.logs}</div><div style={s.statLbl}>Actions</div></div>
            <div style={s.stat}><div style={s.statVal}>{new Date(profile.createdAt).toLocaleDateString("fr-FR")}</div><div style={s.statLbl}>Membre depuis</div></div>
          </div>
        )}

        <label className="profile-select-wrap">
          <span>Section du profil</span>
          <select value={tab} onChange={e => setTab(e.target.value as typeof tab)}>
            {tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <div className="profile-tabs" style={s.tabs}>
          {tabs.map(t => <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>

        {tab === "info" && profile && (
          <div className="profile-card" style={s.card}>
            {[["Nom d'utilisateur", profile.username], ["Email", profile.email], ["Rôle", profile.role === "ADMIN" ? "Administrateur" : profile.role === "MODERATOR" ? "Modérateur" : "Utilisateur"], ["Compte créé le", new Date(profile.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })]].map(([l, v], i, arr) => (
              <div key={l}><div style={s.fieldRow}><span style={s.fieldLbl}>{l}</span><span style={s.fieldVal}>{v}</span></div>{i < arr.length - 1 && <div style={s.divider} />}</div>
            ))}
          </div>
        )}

        {tab === "password" && (
          <div className="profile-card" style={s.card}>
            <form onSubmit={changePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {pwdMsg && <div style={pwdMsg.type === "ok" ? s.alertOk : s.alertErr}>{pwdMsg.text}</div>}
              <Field label="Mot de passe actuel"><input style={s.input} type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required /></Field>
              <Field label="Nouveau mot de passe"><input style={s.input} type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required minLength={12} /></Field>
              <small style={{ color: "var(--text2)" }}>12 caractères minimum avec minuscule, majuscule, chiffre et caractère spécial.</small>
              <Field label="Confirmer le nouveau mot de passe"><input style={s.input} type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required /></Field>
              <div className="profile-actions" style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" style={s.btnPrimary} disabled={pwdLoading}>{pwdLoading ? "…" : "Changer"}</button>
              </div>
            </form>
          </div>
        )}

        {tab === "totp" && (
          <div className="profile-card" style={s.card}>
            <h2 style={s.h2}>Authentification à deux facteurs (TOTP)</h2>
            {totpMsg && <div style={{ ...s.alertOk, marginBottom: 16 }}>{totpMsg}</div>}
            {profile?.totpEnabled ? (
              <div>
                <div style={{ ...s.alertOk, marginBottom: 16 }}>
                  Le TOTP est actif.{profile.totpDisabled ? " (Bypass admin en cours — vous pouvez vous connecter sans code)" : ""}
                </div>
                {!profile.totpForced && <button style={{ ...s.btnPrimary, background: "var(--red)", borderColor: "var(--red)" }} onClick={disableTotp}>Désactiver le TOTP</button>}
              </div>
            ) : totpSetup ? (
              <div>
                <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
                  Scannez ce QR code avec Google Authenticator, Aegis ou toute app compatible TOTP, puis entrez le code pour confirmer.
                </p>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  {totpQr && <img src={totpQr} alt="QR TOTP" style={{ borderRadius: 8, border: "1px solid var(--border)" }} />}
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>Secret : <code style={{ fontFamily: "monospace" }}>{totpSetup.secret}</code></div>
                </div>
                <form className="profile-totp-form" onSubmit={confirmTotp} style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <input style={{ ...s.input, maxWidth: 160, textAlign: "center", fontSize: 18, letterSpacing: 6, fontWeight: 700 }}
                    type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="000000" required autoFocus />
                  <button type="submit" style={s.btnPrimary}>Confirmer</button>
                </form>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>La vérification en deux étapes ajoute une couche de sécurité supplémentaire à votre compte.</p>
                <button style={s.btnPrimary} onClick={setupTotp}>Configurer le TOTP</button>
              </div>
            )}
          </div>
        )}

        {tab === "notifications" && (
          <div className="profile-card" style={s.card}>
            <h2 style={s.h2}>Préférences de notification</h2>
            {notifSaved && <div style={{ ...s.alertOk, marginBottom: 16 }}>Préférences enregistrées.</div>}
            {notifError && <div style={{ ...s.alertErr, marginBottom: 16 }}>{notifError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <NotifRow label="Me notifier quand une de mes VMs est démarrée ou arrêtée"
                checked={notif.vmPowerAlert} onChange={v => setNotif(p => ({ ...p, vmPowerAlert: v }))} />
              {isAdmin && <>
                <div style={s.divider} />
                <p style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>INFRASTRUCTURE</p>
                <NotifRow label="Me notifier quand une VM Infrastructure est arrêtée"
                  checked={notif.infraStoppedAlert} onChange={v => setNotif(p => ({ ...p, infraStoppedAlert: v }))} />
                <NotifRow label="Me notifier quand une VM Infrastructure est démarrée"
                  checked={notif.infraStartedAlert} onChange={v => setNotif(p => ({ ...p, infraStartedAlert: v }))} />
              </>}
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button style={s.btnPrimary} onClick={saveNotif}>Enregistrer</button>
            </div>
          </div>
        )}

        {tab === "logs" && <div className="profile-history"><LogsClient isAdmin={false} /></div>}
      </div>
    </div>
  );
}

function NotifRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500, color: "var(--text2)" }}>{label}</label>{children}</div>;
}
