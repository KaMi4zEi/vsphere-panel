import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/secrets";
import { badRequest, readJsonObject } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    host: s?.smtpHost ?? "",
    port: s?.smtpPort ?? "465",
    secure: s?.smtpSecure ?? "false",
    user: s?.smtpUser ?? "",
    hasPassword: Boolean(s?.smtpPass),
    from: s?.smtpFrom ?? "",
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await readJsonObject(req);
  if (!body) return badRequest();
  const { host, port, secure, user, pass, from } = body;
  const portNumber = typeof port === "string" && /^\d+$/.test(port) ? Number(port) : NaN;
  if (typeof host !== "string" || host.length > 253 || /[\r\n]/.test(host) ||
      !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535 ||
      !["true", "false"].includes(String(secure)) ||
      typeof user !== "string" || user.length > 320 || /[\r\n]/.test(user) ||
      (pass !== undefined && typeof pass !== "string") ||
      typeof from !== "string" || from.length > 320 || /[\r\n]/.test(from) ||
      (host.trim().length > 0 && (!from.trim() || /\s/.test(host.trim())))) return badRequest("Configuration SMTP invalide");
  const current = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  const endpointChanged = Boolean(current?.smtpPass) && (
    host.trim() !== (current?.smtpHost ?? "") || String(portNumber) !== (current?.smtpPort ?? "465") || user.trim() !== (current?.smtpUser ?? "")
  );
  if (endpointChanged && !(typeof pass === "string" && pass.length > 0)) {
    return badRequest("Un nouveau mot de passe est obligatoire lorsque le serveur, le port ou l’utilisateur SMTP change");
  }
  const storedPass = typeof pass === "string" && pass.length > 0
    ? encryptSecret(pass)
    : current?.smtpPass ?? null;
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: { smtpHost: host.trim(), smtpPort: String(portNumber), smtpSecure: String(secure), smtpUser: user.trim(), smtpPass: storedPass, smtpFrom: from.trim() },
    create: { id: "singleton", smtpHost: host.trim(), smtpPort: String(portNumber), smtpSecure: String(secure), smtpUser: user.trim(), smtpPass: storedPass, smtpFrom: from.trim() },
  });
  await writeAuditLog({ action: "SMTP_SETTINGS_CHANGED", session, visibility: "ADMIN_ONLY", targetType: "settings", targetLabel: "SMTP" });
  return NextResponse.json({ ok: true });
}
