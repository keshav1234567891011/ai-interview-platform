"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserRound,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  Search,
} from "lucide-react";
import { useAuth } from "../auth/auth-provider";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const links = [
    { href: "/resume", label: "Resume workspace", icon: FileText },
    { href: "/jobs/analyze", label: "Job analysis", icon: Search },
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/profile", label: "Profile & settings", icon: UserRound },
  ];
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <p className="sidebar-eyebrow">YOUR WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="workspace-sidebar-note">
          <ShieldCheck size={20} aria-hidden="true" />
          <p>
            Your preparation,
            <br />
            in your own space.
          </p>
        </div>
        <Link className="workspace-user" href="/profile">
          <span>{user?.display_name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user?.display_name}</strong>
            <small>Candidate account</small>
          </div>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </aside>
      <div className="workspace-content">{children}</div>
    </div>
  );
}
