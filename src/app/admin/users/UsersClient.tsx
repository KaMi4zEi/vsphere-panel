"use client";
import { appAdminUsersUsersClientStyles as s } from "@/styles";
import { useState } from "react";

type User = { id: string; username: string; email: string; role: "ADMIN" | "MODERATOR" | "USER"; createdAt: Date; totpEnabled: boolean; totpDisabled: boolean; totpDisabledUntil?: string | Date | null; _count: { assignments: number } };

export default function UsersClient({ initialUsers, actorRole }: { initialUsers: User[]; actorRole: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [manageUser, setManageUser] = useState<User | null>(null);
  const [roleDraft, setRoleDraft] = useState<User["role"]>("USER");
  const [totpBypassMinutes, setTotpBypassMinutes] = useState(60);
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "USER", mustChangePassword: true });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"az" | "za">("az");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 4000); }

  async function createUser(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json(); setLoading(false);
    if (!res.ok) { setError(data.error ?? "Erreur"); return; }
    setShowCreate(false); setForm({ username: "", email: "", password: "", role: "USER", mustChangePassword: true });
    setUsers(prev => [{ ...data, _count: { assignments: 0 }, totpEnabled: false, totpDisabled: false, createdAt: new Date() }, ...prev]);
    showToast("Utilisateur créé.");
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(`Erreur : ${data.error ?? "suppression impossible"}`);
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    showToast("Utilisateur supprimé.");
  }

  function openManage(user: User) { setManageUser(user); setRoleDraft(user.role); }

  async function adminAction(userId: string, action: string, extra: Record<string, unknown> = {}) {
    setActionLoading(true);
    const res = await fetch(`/api/users/${userId}/manage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const data = await res.json(); setActionLoading(false);
    if (res.ok) {
      showToast(data.message);
      // Update local state to reflect changes
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        if (action === "reset_totp") return { ...u, totpEnabled: false, totpDisabled: false };
        if (action === "disable_totp") return { ...u, totpDisabled: true, totpDisabledUntil: data.totpDisabledUntil };
        if (action === "enable_totp") return { ...u, totpDisabled: false, totpDisabledUntil: null };
        if (action === "change_role") return { ...u, role: data.role, totpDisabled: false };
        return u;
      }));
      setManageUser(prev => {
        if (!prev || prev.id !== userId) return prev;
        if (action === "reset_totp") return { ...prev, totpEnabled: false, totpDisabled: false };
        if (action === "disable_totp") return { ...prev, totpDisabled: true, totpDisabledUntil: data.totpDisabledUntil };
        if (action === "enable_totp") return { ...prev, totpDisabled: false, totpDisabledUntil: null };
        if (action === "change_role") return { ...prev, role: data.role, totpDisabled: false };
        if (action === "reset_password") return prev;
        return prev;
      });
    } else showToast(`Erreur : ${data.error}`);
  }

  const filtered = users
    .filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "az" ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username));

  return (
    <div className="users-page">
      <div className="users-page-header" style={s.pageHeader}>
        <div><h1 style={s.h1}>Utilisateurs</h1><p style={s.sub}>{users.filter(u => u.role === "USER").length} utilisateur(s)</p></div>
        <button style={s.btnPrimary} onClick={() => setShowCreate(true)}>+ Nouvel utilisateur</button>
      </div>

      {toast && <div style={s.toast}>{toast}</div>}

      <div className="users-toolbar" style={s.toolbar}>
        <input style={s.search} placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        <button style={{ ...s.sortBtn, ...(sort === "az" ? s.sortActive : {}) }} onClick={() => setSort("az")}>A → Z</button>
        <button style={{ ...s.sortBtn, ...(sort === "za" ? s.sortActive : {}) }} onClick={() => setSort("za")}>Z → A</button>
      </div>

      <div className="users-table-card" style={s.card}>
        <table className="users-table" style={s.table}>
          <thead><tr><Th>Utilisateur</Th><Th>Email</Th><Th>Rôle</Th><Th>TOTP</Th><Th>VMs</Th><Th>Créé</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <Td label="Utilisateur"><strong>{u.username}</strong></Td>
                <Td label="Email" style={{ color: "var(--text2)" }}>{u.email}</Td>
                <Td label="Rôle"><span style={u.role === "ADMIN" ? s.badgeAdmin : u.role === "MODERATOR" ? s.badgeMod : s.badgeUser}>{u.role === "ADMIN" ? "Admin" : u.role === "MODERATOR" ? "Modérateur" : "User"}</span></Td>
                <Td label="TOTP">
                  {u.totpEnabled
                    ? u.totpDisabled
                      ? <span style={s.badgeWarn}>Désactivé (bypass)</span>
                      : <span style={s.badgeGreen}>Actif</span>
                    : <span style={s.badgeGray}>Non configuré</span>}
                </Td>
                <Td label="VMs"><a href={`/admin/users/${u.id}/vms`} style={{ color: "var(--blue)", fontWeight: 500 }}>{u._count.assignments} VM(s)</a></Td>
                <Td label="Créé" style={{ color: "var(--text2)" }}>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</Td>
                <Td label="Actions">
                  <div style={{ display: "flex", gap: 6 }}>
                    <a href={`/admin/users/${u.id}/vms`} style={s.btnSm}>VMs</a>
                    <button style={s.btnSm} onClick={() => openManage(u)}>Gérer</button>
                    {((actorRole === "ADMIN" && u.role !== "ADMIN") || (actorRole === "MODERATOR" && u.role === "USER")) && <button style={{ ...s.btnSm, ...s.btnDanger }} onClick={() => deleteUser(u.id, u.username)}>×</button>}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal création */}
      {showCreate && (
        <div style={s.overlay} onClick={() => setShowCreate(false)}>
          <div className="users-modal" role="dialog" aria-modal="true" style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Créer un utilisateur</h2>
            <form onSubmit={createUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {error && <div style={s.errorBox}>{error}</div>}
              <Field label="Nom d'utilisateur"><input style={s.input} value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required /></Field>
              <Field label="Email"><input style={s.input} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required /></Field>
              <Field label="Mot de passe temporaire"><input style={s.input} type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={12} /></Field>
              <small style={{ color: "var(--text2)" }}>12 caractères minimum avec minuscule, majuscule, chiffre et caractère spécial.</small>
              <Field label="Rôle">
                <select style={s.input} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="USER">Utilisateur</option>
                  {actorRole === "ADMIN" && <option value="MODERATOR">Modérateur</option>}
                  {actorRole === "ADMIN" && <option value="ADMIN">Administrateur</option>}
                </select>
              </Field>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: actorRole === "ADMIN" ? "pointer" : "not-allowed", opacity: actorRole === "ADMIN" ? 1 : 0.5 }}>
                <input
                  type="checkbox"
                  checked={form.mustChangePassword}
                  disabled={actorRole !== "ADMIN"}
                  onChange={e => actorRole === "ADMIN" && setForm(p => ({ ...p, mustChangePassword: e.target.checked }))}
                />
                Demander un changement de mot de passe à la première connexion
                {actorRole !== "ADMIN" && <span style={{ fontSize: 11, color: "var(--text3)" }}>(réservé aux admins)</span>}
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" style={s.btnSm} onClick={() => setShowCreate(false)}>Annuler</button>
                <button type="submit" style={s.btnPrimary} disabled={loading}>{loading ? "…" : "Créer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal gestion compte */}
      {manageUser && (
        <div style={s.overlay} onClick={() => setManageUser(null)}>
          <div className="users-modal" role="dialog" aria-modal="true" style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Gérer — {manageUser.username}</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>{manageUser.email}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {actorRole === "ADMIN" && (
                <div className="users-action-row" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>Modifier le rôle</div><div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>Les utilisateurs et modérateurs sont soumis au TOTP obligatoire.</div></div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <select style={{ ...s.input, minWidth: 130 }} value={roleDraft} onChange={e => setRoleDraft(e.target.value as User["role"])} disabled={actionLoading}>
                      <option value="USER">Utilisateur</option><option value="MODERATOR">Modérateur</option><option value="ADMIN">Administrateur</option>
                    </select>
                    <button style={s.btnPrimary} disabled={actionLoading || roleDraft === manageUser.role} onClick={() => adminAction(manageUser.id, "change_role", { role: roleDraft })}>Appliquer</button>
                  </div>
                </div>
              )}
              <ActionRow
                title="Réinitialiser le mot de passe"
                desc="Génère un mot de passe aléatoire et l'envoie par email à l'utilisateur."
                btnLabel="Réinitialiser et envoyer"
                btnStyle={s.btnWarn}
                onClick={() => adminAction(manageUser.id, "reset_password")}
                disabled={actionLoading}
              />
              {/* Désactiver TOTP — disponible même si pas encore configuré (bypass setup forcé) */}
              {!manageUser.totpDisabled && (
                <div className="users-action-row" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{manageUser.totpEnabled ? "Désactiver temporairement le TOTP" : "Dérogation temporaire à la configuration TOTP"}</div><div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>La dérogation expire automatiquement.</div></div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <select style={{ ...s.input, minWidth: 110 }} value={totpBypassMinutes} onChange={e => setTotpBypassMinutes(Number(e.target.value))} disabled={actionLoading}>
                      <option value={15}>15 minutes</option><option value={60}>1 heure</option><option value={240}>4 heures</option><option value={1440}>1 jour</option><option value={10080}>7 jours</option>
                    </select>
                    <button style={{ ...s.btnWarn, padding: "6px 12px", border: "none", borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600 }} onClick={() => adminAction(manageUser.id, "disable_totp", { durationMinutes: totpBypassMinutes })} disabled={actionLoading}>Désactiver</button>
                  </div>
                </div>
              )}
              {manageUser.totpDisabled && (
                <ActionRow
                  title="Réactiver le TOTP"
                  desc={`Expiration automatique : ${manageUser.totpDisabledUntil ? new Date(manageUser.totpDisabledUntil).toLocaleString("fr-FR") : "inconnue"}.`}
                  btnLabel="Réactiver TOTP"
                  btnStyle={s.btnPrimary}
                  onClick={() => adminAction(manageUser.id, "enable_totp")}
                  disabled={actionLoading}
                />
              )}
              {manageUser.totpEnabled && (
                <ActionRow
                  title="Réinitialiser le TOTP"
                  desc="Supprime le secret TOTP. L'utilisateur devra reconfigurer son application."
                  btnLabel="Réinitialiser TOTP"
                  btnStyle={s.btnDangerFull}
                  onClick={() => adminAction(manageUser.id, "reset_totp")}
                  disabled={actionLoading}
                />
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button style={s.btnSm} onClick={() => setManageUser(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ActionRowProps = {
  title: string;
  desc: string;
  btnLabel: string;
  btnStyle: React.CSSProperties;
  onClick: () => void;
  disabled: boolean;
};

function ActionRow({ title, desc, btnLabel, btnStyle, onClick, disabled }: ActionRowProps) {
  return (
    <div className="users-action-row" style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div><div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div><div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{desc}</div></div>
      <button style={{ ...btnStyle, padding: "6px 12px", border: "none", borderRadius: "var(--radius)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }} onClick={onClick} disabled={disabled}>{btnLabel}</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><label style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)" }}>{label}</label>{children}</div>;
}
function Th({ children }: { children: React.ReactNode }) { return <th style={s.th}>{children}</th>; }
function Td({ children, style, label }: { children: React.ReactNode; style?: React.CSSProperties; label?: string }) { return <td data-label={label} style={{ ...s.td, ...style }}>{children}</td>; }
