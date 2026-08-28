"use client";
import { componentsSidebarStyles as s } from "@/styles";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSiteName } from "@/lib/site-context";
import ThemeToggle from "@/components/ThemeToggle";
import BrandIcon from "@/components/BrandIcon";

type NavItem = { href: string; label: string; icon: string; exact?: boolean; adminOnly?: boolean };

const navAdmin: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: "grid", exact: true },
  { href: "/admin/users", label: "Utilisateurs", icon: "users" },
  { href: "/admin/vms", label: "Machines virtuelles", icon: "server" },
  { href: "/admin/infrastructure", label: "Infrastructure", icon: "infra", adminOnly: true },
  { href: "/dashboard", label: "Mes VMs", icon: "myvms" },
  { href: "/admin/logs", label: "Logs d'activité", icon: "logs" },
  { href: "/admin/identity", label: "Configuration du site", icon: "palette", adminOnly: true },
  { href: "/profile", label: "Mon profil", icon: "profile" },
];

const navUser: NavItem[] = [
  { href: "/dashboard", label: "Mes machines", icon: "server", exact: true },
  { href: "/profile", label: "Mon profil", icon: "profile" },
];

function Icon({ name }: { name: string }) {
  if (name === "grid") return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7"/></svg>;
  if (name === "users") return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" fill="currentColor" opacity=".8"/><path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".6"/></svg>;
  if (name === "server") return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity=".7"/><rect x="1" y="9" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity=".7"/><circle cx="12.5" cy="5" r="1" fill="currentColor" opacity=".8"/><circle cx="12.5" cy="11" r="1" fill="currentColor" opacity=".8"/></svg>;
  if (name === "infra") return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity=".7"/><rect x="1" y="7" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity=".7"/><rect x="1" y="13" width="14" height="2" rx="1" fill="currentColor" opacity=".4"/></svg>;
  if (name === "logs") return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none" opacity=".7"/><line x1="4" y1="5.5" x2="12" y2="5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".6"/><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".6"/><line x1="4" y1="10.5" x2="9" y2="10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".6"/></svg>;
  if (name === "palette") return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none" opacity=".7"/><circle cx="5.5" cy="6" r="1" fill="currentColor" opacity=".8"/><circle cx="10.5" cy="6" r="1" fill="currentColor" opacity=".8"/><circle cx="8" cy="11" r="1" fill="currentColor" opacity=".8"/></svg>;
  if (name === "myvms") return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity=".7"/><circle cx="13" cy="11" r="2.5" fill="currentColor" opacity=".8"/><line x1="13" y1="9.5" x2="13" y2="12.5" stroke="white" strokeWidth="1" strokeLinecap="round"/><line x1="11.5" y1="11" x2="14.5" y2="11" stroke="white" strokeWidth="1" strokeLinecap="round"/></svg>;
  if (name === "profile") return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none" opacity=".8"/><path d="M3 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity=".6"/></svg>;
  return null;
}

type SidebarProps = {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export default function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user.role;
  const isAdmin = role === "ADMIN";
  const isMod = role === "MODERATOR";
  const isPrivileged = isAdmin || isMod;
  const nav = isPrivileged
    ? navAdmin.filter(item => !item.adminOnly || isAdmin)
    : navUser;
  const siteName = useSiteName();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
  }, []);

  useEffect(() => {
    onMobileOpenChange(false);
  }, [pathname, onMobileOpenChange]);

  function toggleCollapsed() {
    setCollapsed(current => {
      const next = !current;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  const roleLabel = isAdmin ? "Administrateur" : isMod ? "Modérateur" : "Utilisateur";

  async function logout() {
    await signOut({ redirect: false });
    window.location.assign("/login");
  }

  return (
    <>
      <button
        className="mobile-menu-button"
        type="button"
        aria-label="Ouvrir le menu"
        aria-expanded={mobileOpen}
        onClick={() => onMobileOpenChange(true)}
      >
        <span /><span /><span />
      </button>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Fermer le menu" onClick={() => onMobileOpenChange(false)} />}
      <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`} style={s.aside}>
      <div className="sidebar-logo-wrap" style={s.logoWrap}>
        <BrandIcon size={26} />
        <div className="sidebar-label" style={s.logoTitle}>{siteName}</div>
        <button
          className="sidebar-collapse-button"
          type="button"
          title={collapsed ? "Déplier le menu" : "Réduire le menu"}
          aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
          aria-pressed={collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <nav style={s.nav}>
        <div className="sidebar-label" style={s.navSection}>{isPrivileged ? "Administration" : "Mon espace"}</div>
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
              <Icon name={item.icon} />
              <span className="sidebar-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={s.footer}>
        <div style={s.userInfo}>
          <div style={s.avatar}>{(session?.user?.name ?? "?")[0].toUpperCase()}</div>
          <div className="sidebar-label" style={{ overflow: "hidden" }}>
            <div style={s.userName}>{session?.user?.name}</div>
            <div style={s.userRole}>{roleLabel}</div>
          </div>
        </div>
        <ThemeToggle />
        <button style={s.logoutBtn} title="Déconnexion" onClick={logout}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </button>
      </div>
      </aside>
    </>
  );
}
