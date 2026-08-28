// src/app/admin/logs/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogsClient from "./LogsClient";

export default async function LogsPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session?.user as any)?.role !== "ADMIN" && (session?.user as any)?.role !== "MODERATOR") redirect("/dashboard");
  return <LogsClient isAdmin={session.user.role === "ADMIN"} />;
}
