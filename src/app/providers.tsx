"use client";
// src/app/providers.tsx
import { SessionProvider as NextSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return <NextSessionProvider session={session}>{children}</NextSessionProvider>;
}
