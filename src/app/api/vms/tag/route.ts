import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminOrMod } from "@/lib/permissions";
import { badRequest, readJsonObject } from "@/lib/http";
import { writeAuditLog } from "@/lib/audit-log";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJsonObject(req);
  const vmId = body?.vmId;
  const customName = body?.customName;
  const scope = body?.scope;
  // scope = "user" → toujours Assignment.customName (tag personnel, violet)
  // scope = "global" → VM.customName (tag global, orange, admin/modo seulement)
  // par défaut : "user" pour les users, "global" pour les admins/modos
  if (typeof vmId !== "string" || (customName !== undefined && customName !== null && typeof customName !== "string") ||
      (typeof customName === "string" && customName.trim().length > 80) ||
      (scope !== undefined && scope !== "user" && scope !== "global")) return badRequest();
  const normalizedName = typeof customName === "string" ? customName.trim() || null : null;
  const vmRecord = await prisma.vM.findUnique({ where: { id: vmId }, select: { isInfra: true } });
  if (!vmRecord) return NextResponse.json({ error: "VM introuvable" }, { status: 404 });
  if (vmRecord.isInfra && session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = (session.user as any).id;
  const useGlobalScope = isAdminOrMod(session) && scope !== "user";

  if (useGlobalScope) {
    const vm = await prisma.vM.update({
      where: { id: vmId },
      data: { customName: normalizedName },
    });
    await writeAuditLog({ action: "VM_TAG_UPDATED", session, targetType: "vm", targetId: vmId, targetLabel: vm.customName ?? vmId, details: normalizedName ? `Tag global : ${normalizedName}` : "Tag global retiré" });
    return NextResponse.json({ ok: true, customName: vm.customName });
  } else {
    const assignment = await prisma.assignment.findUnique({
      where: { userId_vmId: { userId, vmId } },
    });
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updated = await prisma.assignment.update({
      where: { userId_vmId: { userId, vmId } },
      data: { customName: normalizedName },
    });
    await writeAuditLog({ action: "VM_TAG_UPDATED", session, targetType: "vm", targetId: vmId, targetLabel: vmId, details: normalizedName ? `Tag personnel : ${normalizedName}` : "Tag personnel retiré" });
    return NextResponse.json({ ok: true, customName: updated.customName });
  }
}
