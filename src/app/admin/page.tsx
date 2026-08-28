import { appAdminPageStyles as s } from "@/styles";
// src/app/admin/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "MODERATOR")) redirect("/dashboard");

  const visibleVmFilter = role === "MODERATOR" ? { isInfra: false } : {};
  const [userCount, vmCount, assignedVmCount, freeVmCount] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.vM.count({ where: visibleVmFilter }),
    prisma.vM.count({ where: { ...visibleVmFilter, assignments: { some: {} } } }),
    prisma.vM.count({ where: { ...visibleVmFilter, assignments: { none: {} } } }),
  ]);

  const recentUsers = await prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, username: true, email: true, createdAt: true, _count: { select: { assignments: true } } },
  });

  return (
    <div>
      <h1 style={s.h1}>Tableau de bord</h1>
      <p style={s.sub}>Bienvenue sur le panel d'administration vSphere</p>

      <div style={s.statsGrid}>
        <StatCard label="Utilisateurs" value={userCount} color="var(--blue)" />
        <StatCard label="VMs enregistrées" value={vmCount} color="#7c3aed" />
        <StatCard label="VMs attribuées" value={assignedVmCount} color="var(--green)" />
        <StatCard label="VMs libres" value={freeVmCount} color="var(--text2)" />
      </div>

      <div style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.h2}>Derniers utilisateurs</h2>
          <a href="/admin/users" style={s.link}>Voir tous →</a>
        </div>
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr>
                <Th>Utilisateur</Th>
                <Th>Email</Th>
                <Th>VMs</Th>
                <Th>Inscrit le</Th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <Td><strong>{u.username}</strong></Td>
                  <Td style={{ color: "var(--text2)" }}>{u.email}</Td>
                  <Td>
                    <span style={u._count.assignments > 0 ? s.badgeBlue : s.badgeGray}>
                      {u._count.assignments}
                    </span>
                  </Td>
                  <Td style={{ color: "var(--text2)" }}>
                    {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                  </Td>
                </tr>
              ))}
              {recentUsers.length === 0 && (
                <tr><td colSpan={4} style={{ ...s.td, color: "var(--text3)", textAlign: "center", padding: "24px" }}>
                  Aucun utilisateur pour l'instant
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statValue, color }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={s.th}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ ...s.td, ...style }}>{children}</td>;
}
