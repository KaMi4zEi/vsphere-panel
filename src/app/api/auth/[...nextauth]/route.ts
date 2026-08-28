// src/app/api/auth/[...nextauth]/route.ts
// Ce fichier n'exporte QUE handler GET et POST — requis par Next.js 14
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
