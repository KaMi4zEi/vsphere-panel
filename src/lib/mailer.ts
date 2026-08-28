// src/lib/mailer.ts
import nodemailer from "nodemailer";
import { decryptSecret } from "@/lib/secrets";
import { prisma } from "@/lib/prisma";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]!);
}

function emailSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").slice(0, 200);
}

async function getSiteSettings() {
  try {
    const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
    return {
      siteName: s?.siteName || "vSphere Panel",
      host: s?.smtpHost || "",
      port: Number(s?.smtpPort || 465),
      secure: s?.smtpSecure === "true",
      user: s?.smtpUser || "",
      pass: decryptSecret(s?.smtpPass),
      from: s?.smtpFrom || "",
    };
  } catch {
    return {
      siteName: "vSphere Panel",
      host: "",
      port: 465,
      secure: false,
      user: "",
      pass: "",
      from: "",
    };
  }
}

async function getTransporter() {
  const cfg = await getSiteSettings();
  if (!cfg.host) return null;
  return {
    transporter: nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    }),
    from: cfg.from,
    siteName: cfg.siteName,
  };
}

function emailBase(siteName: string, content: string) {
  const safeSiteName = escapeHtml(siteName);
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border:1px solid #e5e5e3;border-radius:12px;overflow:hidden;">
    <div style="background:#2563eb;padding:20px 28px;">
      <div style="color:#ffffff;font-size:18px;font-weight:700;">${safeSiteName}</div>
    </div>
    <div style="padding:28px;">
      ${content}
      <hr style="border:none;border-top:1px solid #e5e5e3;margin:24px 0 16px;"/>
      <p style="margin:0;font-size:12px;color:#9ca3af;">Ce message a été envoyé automatiquement par <strong>${safeSiteName}</strong>. Ne pas répondre à cet email.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendTestMail(to: string, siteName?: string) {
  const t = await getTransporter();
  if (!t) throw new Error("SMTP non configuré");
  const name = siteName ?? t.siteName;
  await t.transporter.sendMail({
    from: t.from, to,
    subject: emailSubject(`[${name}] Email de test`),
    html: emailBase(name, `
      <p style="margin:0 0 16px;font-size:15px;color:#374151;">Ceci est un email de test.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;">
        <p style="margin:0;font-size:14px;color:#166534;">✅ La configuration SMTP est correcte.</p>
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:#6b6b68;">Serveur : ${escapeHtml(t.siteName)}</p>
    `),
  });
}

export async function sendPasswordReset(payload: { to: string; username: string; newPassword: string }) {
  const t = await getTransporter();
  if (!t) return false;
  const { siteName } = t;
  await t.transporter.sendMail({
    from: t.from, to: payload.to,
    subject: emailSubject(`[${siteName}] Réinitialisation de votre mot de passe`),
    html: emailBase(siteName, `
      <p style="margin:0 0 16px;font-size:15px;color:#374151;">Bonjour <strong>${escapeHtml(payload.username)}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#374151;">Un administrateur a réinitialisé votre mot de passe.</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">Mot de passe temporaire</p>
        <code style="font-size:20px;font-weight:700;color:#92400e;letter-spacing:2px;">${escapeHtml(payload.newPassword)}</code>
      </div>
      <p style="margin:0;font-size:13px;color:#6b6b68;">⚠️ Vous devrez définir un nouveau mot de passe lors de votre prochaine connexion.</p>
    `),
  });
  return true;
}

export async function sendVmPowerNotifications(
  vmId: string,
  vmName: string,
  action: "POWER_ON" | "POWER_OFF",
  actorName: string,
  actorUserId?: string,
) {
  // Une requête unique déduplique naturellement l'acteur et les utilisateurs attribués.
  // Aucun destinataire n'est ajouté sans préférence vmPowerAlert active.
  const recipients = await prisma.user.findMany({
    where: {
      notifications: { is: { vmPowerAlert: true } },
      OR: [
        { assignments: { some: { vmId } } },
        ...(actorUserId ? [{ id: actorUserId }] : []),
      ],
    },
    select: { email: true, username: true },
  });

  const t = await getTransporter();
  if (!t) return;
  const { siteName } = t;
  const isStart = action === "POWER_ON";
  const verb = isStart ? "démarrée" : "arrêtée";
  const color = isStart ? "#16a34a" : "#dc2626";
  const icon = isStart ? "▶" : "■";
  const dateStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  for (const user of recipients) {
    if (!user.email) continue;

    await t.transporter.sendMail({
      from: t.from,
      to: user.email,
      subject: emailSubject(`[${siteName}] VM "${vmName}" ${verb}`),
      html: emailBase(siteName, `
        <p style="margin:0 0 16px;font-size:15px;color:#374151;">Bonjour <strong>${escapeHtml(user.username)}</strong>,</p>
        <div style="background:#f9f9f8;border:1px solid #e5e5e3;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b6b68;">Machine virtuelle</p>
          <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a18;">${escapeHtml(vmName)}</p>
          <span style="display:inline-block;background:${color}1a;color:${color};border:1px solid ${color}4d;border-radius:99px;padding:4px 12px;font-size:13px;font-weight:600;">${icon} ${isStart ? "Démarrée" : "Arrêtée"}</span>
        </div>
        <table style="width:100%;font-size:13px;color:#374151;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#6b6b68;width:120px;">Date</td><td>${dateStr}</td></tr>
          <tr><td style="padding:4px 0;color:#6b6b68;">Action par</td><td><strong>${escapeHtml(actorName)}</strong></td></tr>
        </table>
      `),
    }).catch(err => console.error("[mailer] sendVmPowerNotifications:", err));
  }
}

export async function sendInfraPowerNotification(
  vmName: string, action: "POWER_ON" | "POWER_OFF", actorName: string
) {
  const t = await getTransporter();
  if (!t) return;
  const { siteName } = t;
  const isStart = action === "POWER_ON";
  const alertField = isStart ? "infraStartedAlert" : "infraStoppedAlert";

  // Trouver les admins/modos ayant activé l'alerte infra correspondante
  const usersWithAlert = await prisma.userNotification.findMany({
    where: { [alertField]: true, user: { role: "ADMIN" } },
    include: { user: { select: { email: true, username: true } } },
  });

  const verb = isStart ? "démarrée" : "arrêtée";
  const color = isStart ? "#16a34a" : "#dc2626";
  const icon = isStart ? "▶" : "■";
  const dateStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  for (const n of usersWithAlert) {
    if (!n.user.email) continue;
    await t.transporter.sendMail({
      from: t.from,
      to: n.user.email,
      subject: emailSubject(`[${siteName}] ⚠️ VM Infrastructure "${vmName}" ${verb}`),
      html: emailBase(siteName, `
        <p style="margin:0 0 16px;font-size:15px;color:#374151;">Bonjour <strong>${escapeHtml(n.user.username)}</strong>,</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:12px;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">⚠️ VM Infrastructure</p>
          <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a18;">${escapeHtml(vmName)}</p>
          <span style="display:inline-block;background:${color}1a;color:${color};border:1px solid ${color}4d;border-radius:99px;padding:4px 12px;font-size:13px;font-weight:600;">${icon} ${isStart ? "Démarrée" : "Arrêtée"}</span>
        </div>
        <table style="width:100%;font-size:13px;color:#374151;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#6b6b68;width:120px;">Date</td><td>${dateStr}</td></tr>
          <tr><td style="padding:4px 0;color:#6b6b68;">Action par</td><td><strong>${escapeHtml(actorName)}</strong></td></tr>
        </table>
      `),
    }).catch(err => console.error("[mailer] infraAlert:", err));
  }
}
