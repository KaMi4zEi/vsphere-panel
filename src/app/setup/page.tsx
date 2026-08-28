import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await prisma.user.count() > 0) redirect("/login");
  return <SetupForm />;
}
