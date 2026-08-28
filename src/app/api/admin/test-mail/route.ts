import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendTestMail } from "@/lib/mailer";
import { getSiteName } from "@/lib/settings";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const adminEmail = session.user?.email ?? "";
  const siteName = await getSiteName();
  try {
    await sendTestMail(adminEmail, siteName);
    await writeAuditLog({ action: "SMTP_SETTINGS_CHANGED", session, visibility: "ADMIN_ONLY", targetType: "smtp", targetLabel: "Email de test", details: `Destinataire : ${adminEmail}` });
    return NextResponse.json({ ok: true, message: `Mail de test envoyé à ${adminEmail}` });
  } catch (error) {
    await writeAuditLog({ action: "SMTP_SETTINGS_CHANGED", session, visibility: "ADMIN_ONLY", targetType: "smtp", targetLabel: "Email de test", success: false });
    console.error("[smtp] test failed", error);
    return NextResponse.json({ ok: false, error: "Échec du test SMTP" }, { status: 502 });
  }
}
