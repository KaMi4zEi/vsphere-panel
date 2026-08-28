// src/app/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  if (await prisma.user.count() === 0) redirect("/setup");
  const session = await getServerSession(authOptions);
  redirect(session ? "/dashboard" : "/login");
}
