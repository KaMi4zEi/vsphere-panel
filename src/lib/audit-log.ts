import type { AuditAction, LogVisibility } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  action: AuditAction;
  session?: Session | null;
  actorUserId?: string | null;
  actorUsername?: string;
  actorEmail?: string;
  visibility?: LogVisibility;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: string;
  success?: boolean;
  ipAddress?: string;
};

export async function writeAuditLog(input: AuditInput) {
  const user = input.session?.user;
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId === undefined ? user?.id ?? null : input.actorUserId,
        actorUsername: input.actorUsername ?? user?.name ?? "",
        actorEmail: input.actorEmail ?? user?.email ?? "",
        action: input.action,
        visibility: input.visibility ?? "STAFF",
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel: input.targetLabel,
        details: input.details?.slice(0, 2000),
        success: input.success ?? true,
        ipAddress: input.ipAddress,
      },
    });
  } catch (error) {
    console.error("[audit] journalisation impossible", error);
  }
}
