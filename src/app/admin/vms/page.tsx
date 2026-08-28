import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import VMsClient from "./VMsClient";
import { isAdminOrMod } from "@/lib/permissions";

export default async function VMsPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) redirect("/dashboard");

  const actorRole = (session?.user as any)?.role as string;

  const vms = await prisma.vM.findMany({
    where: actorRole === "MODERATOR" ? { isInfra: false } : undefined,
    include: { assignments: { include: { user: { select: { id: true, username: true } } } } },
    orderBy: { name: "asc" },
  });

  return <VMsClient initialVMs={vms as any} actorRole={actorRole} />;
}
