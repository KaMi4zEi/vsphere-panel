import type { Metadata } from "next";
export const dynamic = "force-dynamic";
import { SessionProvider } from "./providers";
import { SiteProvider } from "@/lib/site-context";
import "./globals.css";
import { prisma } from "@/lib/prisma";

async function getSiteSettings() {
  try {
    const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
    return { siteName: s?.siteName || "vSphere Panel" };
  } catch {
    return { siteName: "vSphere Panel" };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSiteSettings();
  return {
    title: siteName,
    description: `Gestion de machines virtuelles — ${siteName}`,
    icons: { icon: "/api/favicon" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { siteName } = await getSiteSettings();
  return (
    <html lang="fr">
      <body>
        <SessionProvider>
          <SiteProvider initial={siteName}>
            {children}
          </SiteProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
