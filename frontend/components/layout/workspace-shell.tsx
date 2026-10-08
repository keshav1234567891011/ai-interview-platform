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
  MessagesSquare,
  CalendarClock,
  ChartNoAxesCombined,
  History,
} from "lucide-react";
import { useAuth } from "../auth/auth-provider";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/interviews", label: "Interviews", icon: MessagesSquare },
    { href: "/interviews/scheduled", label: "Scheduled", icon: CalendarClock },
    { href: "/interviews/history", label: "History", icon: History },
    { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
    { href: "/resume", label: "Resume workspace", icon: FileText },
    { href: "/jobs/analyze", label: "Job analysis", icon: Search },
    { href: "/profile", label: "Profile & settings", icon: UserRound },
  ];
  if (user?.role === "admin" || user?.role === "owner") links.push({ href: "/admin", label: "Administration", icon: ShieldCheck });
  if (user?.role === "owner") {
    links.unshift({ href: "/owner", label: "Owner overview", icon: ShieldCheck });
    links.push({ href: "/owner/admins", label: "Delegated admins", icon: UserRound }, { href: "/owner/security", label: "Account & security", icon: ShieldCheck });
  }
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <p className="sidebar-eyebrow">YOUR WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href || (href === "/interviews" ? /^\/interviews\/(?!scheduled|history)/.test(pathname) : pathname.startsWith(`${href}/`))
                  ? "page"
                  : undefined
              }
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
        <Link className="workspace-user" href={user?.role === "owner" ? "/owner/security" : "/profile"}>
          <span>{user?.display_name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user?.display_name}</strong>
            <small>{user?.role === "owner" ? "Application owner" : user?.role === "admin" ? "Delegated administrator" : "Candidate account"}</small>
          </div>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </aside>
      <div className="workspace-content">{children}</div>
    </div>
  );
}
