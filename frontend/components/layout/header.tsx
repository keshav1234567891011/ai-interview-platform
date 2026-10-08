"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Brand } from "./brand";
import { Container } from "./container";
import { ThemeToggle } from "./theme-toggle";
import { ButtonLink } from "../ui/button";
import { useAuth } from "../auth/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { accountDestination } from "@/lib/auth-destination";

const links = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Preview", href: "#preview" },
];

export function Header() {
  const pathname = usePathname();
  const sectionLink = (hash: string) => (pathname === "/" ? hash : `/${hash}`);
  const { user, logout } = useAuth();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState("");
  async function signOut() {
    try {
      await logout();
      setOpen(false);
      router.push("/");
    } catch {
      setLogoutError("Could not sign out. Please try again.");
    }
  }
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    const breakpoint = window.matchMedia("(min-width: 800px)");
    const resize = () => {
      if (breakpoint.matches) setOpen(false);
    };
    document.addEventListener("keydown", close);
    breakpoint.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", close);
      breakpoint.removeEventListener("change", resize);
    };
  }, [open]);
  return (
    <header className="site-header">
      <Container className="header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <a key={link.href} href={sectionLink(link.href)}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <a
            className="sign-in desktop-only"
            href={user ? accountDestination(user) : "/login"}
          >
            {user ? "Dashboard" : "Sign In"}
          </a>
          {user ? (
            <>
              <a
                className="sign-in desktop-only header-user"
                href={user.role === "owner" ? "/owner/security" : user.password_change_required ? "/change-password" : "/profile"}
                aria-label={`Profile for ${user.display_name}`}
              >
                {user.display_name}
              </a>
              <button
                className="button button-secondary desktop-only header-cta"
                onClick={() => void signOut()}
              >
                Logout
              </button>
            </>
          ) : (
            <ButtonLink className="desktop-only header-cta" href="/register">
              Start Practicing <ArrowUpRight size={15} aria-hidden="true" />
            </ButtonLink>
          )}
          <button
            ref={menuButton}
            className="icon-button mobile-menu-button"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <X size={21} aria-hidden="true" />
            ) : (
              <Menu size={21} aria-hidden="true" />
            )}
          </button>
        </div>
      </Container>
      <nav
        id="mobile-navigation"
        className="mobile-nav"
        hidden={!open}
        aria-label="Mobile navigation"
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={sectionLink(link.href)}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <a href={user ? accountDestination(user) : "/login"} onClick={() => setOpen(false)}>
          {user ? "Dashboard" : "Sign In"}
        </a>
        {user ? (
          <>
            <a href={user.role === "owner" ? "/owner/security" : user.password_change_required ? "/change-password" : "/profile"} onClick={() => setOpen(false)}>
              Profile
            </a>
            <button
              className="button button-secondary"
              onClick={() => void signOut()}
            >
              Logout
            </button>
          </>
        ) : (
          <ButtonLink href="/register" onClick={() => setOpen(false)}>
            Start Practicing <ArrowUpRight size={16} aria-hidden="true" />
          </ButtonLink>
        )}
      </nav>
      {logoutError && (
        <p className="form-error" role="alert">
          {logoutError}
        </p>
      )}
    </header>
  );
}
