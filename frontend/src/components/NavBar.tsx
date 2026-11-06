"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) api<{ role: string }>("/account/me", {}, true).then((profile) => setRole(profile.role)).catch(() => setRole(null));
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setRole(null);
      if (s) api<{ role: string }>("/account/me", {}, true).then((profile) => setRole(profile.role)).catch(() => setRole(null));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  return (
    <nav className="nav" aria-label="Main navigation">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden="true">🦉</span>
        <span>Pantry Owl</span>
      </Link>
      <div className="nav-actions">
        <div className="nav-popover">
          <button
            className="icon-button"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="pantry-navigation-menu"
            onClick={() => {
              setMenuOpen((open) => !open);
              setAccountOpen(false);
            }}
          >
            <MenuIcon open={menuOpen} />
          </button>
          {menuOpen && (
            <div className="nav-popover-panel" id="pantry-navigation-menu">
              <Link href="/locations" aria-current={pathname === "/locations" ? "page" : undefined}>
                Pantry locations
              </Link>
              {(role === "admin" || role === "cashier" || role === "stocker") && (
                <Link href="/staff" aria-current={pathname === "/staff" ? "page" : undefined}>Staff tools</Link>
              )}
              {role === "admin" && (
                <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}>Admin tools</Link>
              )}
            </div>
          )}
        </div>

        <Link
          href="/list"
          className="icon-button"
          aria-label="My shopping list"
          aria-current={pathname === "/list" ? "page" : undefined}
          title="My shopping list"
        >
          <CartIcon />
        </Link>

        {session ? (
          <div className="nav-popover">
            <button
              className="icon-button"
              type="button"
              aria-label={accountOpen ? "Close account menu" : "Open account menu"}
              aria-expanded={accountOpen}
              aria-controls="pantry-account-menu"
              onClick={() => {
                setAccountOpen((open) => !open);
                setMenuOpen(false);
              }}
            >
              <AccountIcon />
            </button>
            {accountOpen && (
              <div className="nav-popover-panel nav-account-panel" id="pantry-account-menu">
                <span className="nav-account-email">{session.user.email}</span>
                <button type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
              </div>
            )}
          </div>
        ) : (
          <Link className="icon-button" href="/login" aria-label="Sign in" title="Sign in">
            <AccountIcon />
          </Link>
        )}
      </div>
    </nav>
  );
}
