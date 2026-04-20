"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  FilePlus,
  FileText,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", Icon: FileText },
  { href: "/proposals", label: "Proposals", Icon: FilePlus },
  { href: "/pipeline", label: "Pipeline", Icon: TrendingUp },
  { href: "/clients", label: "Clients", Icon: Users },
  { href: "/services", label: "Services", Icon: Briefcase },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const settingsActive =
    pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <nav className="sidebar-nav">
      {nav.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item${active ? " active" : ""}`}
          >
            <Icon
              size={16}
              strokeWidth={1.75}
              style={{
                color: active ? "var(--accent)" : "var(--muted)",
                flexShrink: 0,
              }}
              aria-hidden
            />
            <span>{label}</span>
          </Link>
        );
      })}
      <a
        href="/capabilities.html"
        target="_blank"
        rel="noopener noreferrer"
        className="nav-item"
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--border)",
          paddingTop: "var(--sp-3)",
        }}
      >
        <BookOpen
          size={16}
          strokeWidth={1.75}
          style={{ color: "var(--muted)", flexShrink: 0 }}
          aria-hidden
        />
        <span>Capabilities Deck</span>
      </a>
      <Link
        href="/settings"
        className={`nav-item${settingsActive ? " active" : ""}`}
      >
        <Settings
          size={16}
          strokeWidth={1.75}
          style={{
            color: settingsActive ? "var(--accent)" : "var(--muted)",
            flexShrink: 0,
          }}
          aria-hidden
        />
        <span>Settings</span>
      </Link>
    </nav>
  );
}
