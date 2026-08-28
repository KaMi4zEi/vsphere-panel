"use client";
import { appAdminIdentityPageStyles as s } from "@/styles";
import { useState, useEffect, useRef } from "react";

async function apiError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

export default function SiteConfigPage() {
  // Identité
  const [siteName, setSiteName] = useState("");
  const [savedName, setSavedName] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [hasFavicon, setHasFavicon] = useState(false);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [faviconLoading, setFaviconLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // SMTP
  const [smtp, setSmtp] = useState({ host: "", port: "465", secure: "false", user: "", pass: "", from: "", hasPassword: false });
  const [savedSmtp, setSavedSmtp] = useState(false);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpTest, setSmtpTest] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [vcenter, setVcenter] = useState({ host: "", user: "", pass: "", tlsVerify: true, hasPassword: false, monitorEnabled: false, monitorIntervalSeconds: 300 });
  const [vcenterLoading, setVcenterLoading] = useState(false);
  const [vcenterSaved, setVcenterSaved] = useState(false);
  const [trustedProxyIps, setTrustedProxyIps] = useState("");
  const [proxySaved, setProxySaved] = useState(false);

  useEffect(() => {
    fetch("/api/identity").then(r => r.json()).then(d => {
      setSiteName(d.siteName ?? "");
      setHasFavicon(d.hasFavicon ?? false);
    });
    fetch("/api/admin/smtp").then(r => r.json()).then(d => {
      if (d && !d.error) setSmtp({ host: d.host, port: d.port, secure: d.secure, user: d.user, pass: "", from: d.from, hasPassword: d.hasPassword });
    }).catch(() => {});
    fetch("/api/admin/security").then(r => r.json()).then(d => { if (d && !d.error) setTrustedProxyIps(d.trustedProxyIps ?? ""); }).catch(() => {});
    fetch("/api/admin/vcenter").then(r => r.json()).then(d => {
      if (d && !d.error) setVcenter({ host: d.host, user: d.user, pass: "", tlsVerify: d.tlsVerify, hasPassword: d.hasPassword, monitorEnabled: d.monitorEnabled, monitorIntervalSeconds: d.monitorIntervalSeconds });
    }).catch(() => {});
  }, []);

  async function saveVcenter(e: React.FormEvent) {
    e.preventDefault(); setVcenterLoading(true); setVcenterSaved(false);
    const response = await fetch("/api/admin/vcenter", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vcenter) });
    setVcenterLoading(false);
    if (!response.ok) { alert(await apiError(response, "Impossible d’enregistrer la configuration vCenter.")); return; }
    setVcenter(p => ({ ...p, pass: "", hasPassword: true })); setVcenterSaved(true);
    setTimeout(() => setVcenterSaved(false), 3000);
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameLoading(true); setSavedName(false);
    const response = await fetch("/api/identity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteName }) });
    setNameLoading(false);
    if (!response.ok) { alert(await apiError(response, "Impossible d’enregistrer le nom du site.")); return; }
    setSavedName(true);
    setTimeout(() => setSavedName(false), 3000);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"].includes(file.type)) { alert("Format non pris en charge (PNG, JPEG, WEBP, ICO ou SVG)"); e.target.value = ""; return; }
    if (file.size > 512 * 1024) { alert("Fichier trop volumineux (max 512 Ko)"); return; }
    const reader = new FileReader();
    reader.onload = ev => setFaviconPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function saveFavicon() {
    if (!faviconPreview) return;
    setFaviconLoading(true);
    const mimeMatch = faviconPreview.match(/^data:([^;]+);/);
    const response = await fetch("/api/identity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ faviconData: faviconPreview, faviconType: mimeMatch?.[1] ?? "image/png" }) });
    if (!response.ok) { setFaviconLoading(false); alert(await apiError(response, "Impossible d’enregistrer le favicon.")); return; }
    setHasFavicon(true); setFaviconPreview(null);
    if (fileRef.current) fileRef.current.value = "";
    setFaviconLoading(false);
  }

  async function removeFavicon() {
    if (!confirm("Supprimer la favicon personnalisée ?")) return;
    const response = await fetch("/api/identity", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeFavicon: true }) });
    if (!response.ok) { alert(await apiError(response, "Impossible de supprimer le favicon.")); return; }
    setHasFavicon(false); setFaviconPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function saveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setSmtpLoading(true); setSavedSmtp(false);
    const response = await fetch("/api/admin/smtp", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(smtp) });
    setSmtpLoading(false);
    if (!response.ok) { alert(await apiError(response, "Impossible d’enregistrer la configuration SMTP.")); return; }
    setSmtp(p => ({ ...p, pass: "", hasPassword: Boolean(p.pass) || p.hasPassword }));
    setSavedSmtp(true);
    setTimeout(() => setSavedSmtp(false), 3000);
  }

  async function saveTrustedProxies(e: React.FormEvent) {
    e.preventDefault(); setProxySaved(false);
    const response = await fetch("/api/admin/security", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trustedProxyIps }) });
    if (!response.ok) { alert(await apiError(response, "Impossible d’enregistrer les proxys de confiance.")); return; }
    const data = await response.json(); setTrustedProxyIps(data.trustedProxyIps ?? ""); setProxySaved(true);
    setTimeout(() => setProxySaved(false), 3000);
  }

  async function testSmtp() {
    setTestLoading(true); setSmtpTest(null);
    const res = await fetch("/api/admin/test-mail", { method: "POST" });
    setSmtpTest(await res.json());
    setTestLoading(false);
  }

  return (
    <div className="identity-page">
      <h1 style={s.h1}>Configuration du site</h1>
      <p style={s.sub}>Identité visuelle, favicon et configuration des emails.</p>

      <div className="identity-card" style={s.card}>
        <h2 style={s.h2}>Configuration vCenter</h2>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>Compte de service utilisé pour inventorier et piloter les machines virtuelles.</p>
        <form className="identity-form" onSubmit={saveVcenter} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {vcenterSaved && <div style={s.alertOk}>Configuration vCenter enregistrée.</div>}
          <div className="identity-grid" style={s.grid2}>
            <div style={s.field}><label style={s.label}>Adresse HTTPS</label><input style={s.input} type="url" value={vcenter.host} onChange={e => setVcenter(p => ({ ...p, host: e.target.value }))} placeholder="https://vcenter.domaine.local" required /></div>
            <div style={s.field}><label style={s.label}>Compte de service</label><input style={s.input} value={vcenter.user} onChange={e => setVcenter(p => ({ ...p, user: e.target.value }))} autoComplete="username" required /></div>
            <div style={s.field}><label style={s.label}>Mot de passe</label><input style={s.input} type="password" value={vcenter.pass} onChange={e => setVcenter(p => ({ ...p, pass: e.target.value }))} placeholder={vcenter.hasPassword ? "Laisser vide pour conserver" : "Mot de passe requis"} autoComplete="new-password" required={!vcenter.hasPassword} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}><input type="checkbox" checked={vcenter.tlsVerify} onChange={e => setVcenter(p => ({ ...p, tlsVerify: e.target.checked }))} /> Vérifier le certificat TLS (recommandé)</label>
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}><input type="checkbox" checked={vcenter.monitorEnabled} onChange={e => setVcenter(p => ({ ...p, monitorEnabled: e.target.checked }))} /> Surveiller les changements d’état effectués directement dans vCenter</label>
            <div style={s.field}>
              <label style={s.label}>Intervalle de surveillance</label>
              <select style={s.input} value={vcenter.monitorIntervalSeconds} onChange={e => setVcenter(p => ({ ...p, monitorIntervalSeconds: Number(e.target.value) }))} disabled={!vcenter.monitorEnabled}>
                <option value={30}>30 secondes</option><option value={60}>1 minute</option><option value={300}>5 minutes</option><option value={900}>15 minutes</option><option value={3600}>1 heure</option>
              </select>
            </div>
          </div>
          <div className="identity-actions" style={{ display: "flex" }}><button style={s.btnPrimary} type="submit" disabled={vcenterLoading}>{vcenterLoading ? "Enregistrement…" : "Enregistrer vCenter"}</button></div>
        </form>
      </div>

      {/* Nom du site */}
      <div className="identity-card" style={{ ...s.card, marginTop: 16 }}>
        <h2 style={s.h2}>Nom du site</h2>
        <form className="identity-form" onSubmit={saveName} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {savedName && <div style={s.alertOk}>✅ Nom enregistré.</div>}
          <div style={s.field}>
            <label style={s.label}>Nom affiché (onglet, sidebar, login, emails)</label>
            <input style={s.input} value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="vSphere Panel (par défaut)" maxLength={64} />
          </div>
          <div className="identity-actions" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button style={s.btnPrimary} type="submit" disabled={nameLoading}>{nameLoading ? "Enregistrement…" : "Enregistrer"}</button>
            {siteName && <span style={{ fontSize: 12, color: "var(--text3)" }}>Aperçu : <strong>{siteName}</strong></span>}
          </div>
        </form>
      </div>

      {/* Favicon */}
      <div className="identity-card" style={{ ...s.card, marginTop: 16 }}>
        <h2 style={s.h2}>Favicon</h2>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>Icône de l'onglet navigateur. Formats PNG, JPEG, WEBP, ICO ou SVG, 32×32px recommandé.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
          {hasFavicon && !faviconPreview && (
            <div style={s.faviconBox}>
              <img src={`/api/favicon?t=${Date.now()}`} alt="favicon" style={{ width: 32, height: 32, imageRendering: "pixelated" }} />
              <span style={{ fontSize: 11, color: "var(--text3)" }}>Actuelle</span>
            </div>
          )}
          {faviconPreview && (
            <div style={s.faviconBox}>
              <img src={faviconPreview} alt="aperçu" style={{ width: 32, height: 32, imageRendering: "pixelated" }} />
              <span style={{ fontSize: 11, color: "var(--text3)" }}>Aperçu</span>
            </div>
          )}
          {!hasFavicon && !faviconPreview && (
            <div style={{ ...s.faviconBox, opacity: 0.4 }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="4" fill="#e5e5e3"/><text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#888">?</text></svg>
              <span style={{ fontSize: 11, color: "var(--text3)" }}>Défaut</span>
            </div>
          )}
        </div>
        <div className="identity-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ ...s.btnSecondary, cursor: "pointer", display: "inline-block" }}>
            📁 Choisir un fichier
            <input ref={fileRef} type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp,image/svg+xml,.svg" onChange={onFileChange} style={{ display: "none" }} />
          </label>
          {faviconPreview && <button style={s.btnPrimary} onClick={saveFavicon} disabled={faviconLoading}>{faviconLoading ? "Enregistrement…" : "Enregistrer la favicon"}</button>}
          {hasFavicon && <button style={{ ...s.btnSecondary, color: "var(--red)", borderColor: "#fecaca" }} onClick={removeFavicon}>Supprimer</button>}
        </div>
      </div>

      {/* SMTP */}
      <div className="identity-card" style={{ ...s.card, marginTop: 16 }}>
        <h2 style={s.h2}>Configuration SMTP</h2>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>Paramètres du serveur d'envoi d'emails (notifications, reset de mot de passe).</p>
        <form className="identity-form" onSubmit={saveSmtp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {savedSmtp && <div style={s.alertOk}>✅ Configuration SMTP enregistrée.</div>}
          <div className="identity-grid" style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>Serveur SMTP</label>
              <input style={s.input} value={smtp.host} onChange={e => setSmtp(p => ({ ...p, host: e.target.value }))} placeholder="smtp.exemple.fr" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Port</label>
              <input style={s.input} type="number" value={smtp.port} onChange={e => setSmtp(p => ({ ...p, port: e.target.value }))} placeholder="465" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Utilisateur</label>
              <input style={s.input} value={smtp.user} onChange={e => setSmtp(p => ({ ...p, user: e.target.value }))} placeholder="noreply@exemple.fr" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Mot de passe</label>
              <input style={s.input} type="password" value={smtp.pass} onChange={e => setSmtp(p => ({ ...p, pass: e.target.value }))} placeholder={smtp.hasPassword ? "Laisser vide si serveur, port et utilisateur inchangés" : "Mot de passe"} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Adresse expéditeur</label>
              <input style={s.input} value={smtp.from} onChange={e => setSmtp(p => ({ ...p, from: e.target.value }))} placeholder='Mon Panel <noreply@exemple.fr>' />
            </div>
            <div style={s.field}>
              <label style={s.label}>SSL/TLS</label>
              <select style={s.input} value={smtp.secure} onChange={e => setSmtp(p => ({ ...p, secure: e.target.value }))}>
                <option value="false">STARTTLS (port 587)</option>
                <option value="true">SSL/TLS (port 465)</option>
              </select>
            </div>
          </div>
          <div className="identity-actions" style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button style={s.btnPrimary} type="submit" disabled={smtpLoading}>{smtpLoading ? "Enregistrement…" : "Enregistrer SMTP"}</button>
            <button type="button" style={s.btnSecondary} onClick={testSmtp} disabled={testLoading}>{testLoading ? "Envoi…" : "📧 Tester"}</button>
          </div>
          {smtpTest && (
            <div style={{ ...s.alertOk, ...(smtpTest.ok ? {} : { background: "var(--red-light)", border: "1px solid #fecaca", color: "var(--red)" }) }}>
              {smtpTest.ok ? `✅ ${smtpTest.message}` : `❌ ${smtpTest.error}`}
            </div>
          )}
        </form>
      </div>
      <div className="identity-card" style={{ ...s.card, marginTop: 16 }}>
        <h2 style={s.h2}>Proxys de confiance</h2>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>Une adresse IPv4 ou IPv6 par ligne. Si la liste est vide, le mode compatible d’installation reste actif. Nginx Proxy Manager peut transmettre l’adresse client avec <code>CF-Connecting-IP</code>, <code>X-Real-IP</code> ou <code>X-Forwarded-For</code>.</p>
        <form onSubmit={saveTrustedProxies} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {proxySaved && <div style={s.alertOk}>Proxys de confiance enregistrés.</div>}
          <textarea style={{ ...s.input, minHeight: 90, fontFamily: "monospace" }} value={trustedProxyIps} onChange={e => setTrustedProxyIps(e.target.value)} placeholder={"192.168.50.10\n2001:db8::10"} />
          <div><button style={s.btnPrimary} type="submit">Enregistrer les proxys</button></div>
        </form>
      </div>
    </div>
  );
}
