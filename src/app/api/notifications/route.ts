import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, readJsonObject } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const n = await prisma.userNotification.findUnique({ where: { userId } });
  const defaults = { infraStoppedAlert: false, infraStartedAlert: false, vmPowerAlert: false };
  const result = n ?? defaults;
  return NextResponse.json(session.user.role === "ADMIN" ? result : {
    ...result,
    infraStoppedAlert: false,
    infraStartedAlert: false,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const data = await readJsonObject(req);
  if (!data) return badRequest();
  const allowed = ["infraStoppedAlert", "infraStartedAlert", "vmPowerAlert"] as const;
  const permitted = session.user.role === "ADMIN"
    ? allowed
    : allowed.filter(key => !key.startsWith("infra"));
  const preferences = Object.fromEntries(permitted.filter(key => typeof data[key] === "boolean").map(key => [key, data[key]]));
  const n = await prisma.userNotification.upsert({
    where: { userId },
    update: preferences,
    create: { userId, ...preferences },
  });
  await writeAuditLog({ action: "NOTIFICATION_PREFERENCES_CHANGED", session, targetType: "user", targetId: userId, targetLabel: session.user.name ?? "", details: "Préférences de notification modifiées" });
  return NextResponse.json(n);
}
