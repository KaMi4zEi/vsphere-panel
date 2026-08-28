// src/app/admin/users/[id]/vms/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import UserVMsClient from "./UserVMsClient";
import { canManageRole } from "@/lib/permissions";

export default async function UserVMsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session?.user as any)?.role !== "ADMIN" && (session?.user as any)?.role !== "MODERATOR") redirect("/dashboard");

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { assignments: { include: { vm: true } } },
  });
  if (!user) notFound();
  if (!canManageRole(session!.user.role, user.role)) redirect("/admin/users");

  // Exclure les VMs infrastructure de la liste d'attribution
  const allVMs = await prisma.vM.findMany({ where: { isInfra: false }, orderBy: { name: "asc" } });
  const assignedIds = new Set(user.assignments.map((a) => a.vm.id));

  return (
    <UserVMsClient
      user={{ id: user.id, username: user.username, email: user.email }}
      allVMs={allVMs}
      assignedIds={Array.from(assignedIds)}
    />
  );
}
