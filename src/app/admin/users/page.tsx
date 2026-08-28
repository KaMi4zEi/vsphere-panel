import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";
import { isAdminOrMod } from "@/lib/permissions";
import { isTotpBypassActive } from "@/lib/totp-policy";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) redirect("/dashboard");

  const actorRole = (session?.user as any)?.role as string;

  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, createdAt: true, totpEnabled: true, totpDisabled: true, totpDisabledUntil: true, _count: { select: { assignments: { where: { vm: { isInfra: false } } } } } },
    orderBy: { createdAt: "desc" },
  });

  // Modérateur ne voit pas les admins
  const visibleUsers = users.map(user => ({ ...user, totpDisabled: isTotpBypassActive(user.totpDisabled, user.totpDisabledUntil) }));
  const filtered = actorRole === "MODERATOR" ? visibleUsers.filter(u => u.role === "USER") : visibleUsers;

  return <UsersClient initialUsers={filtered as any} actorRole={actorRole} />;
}
