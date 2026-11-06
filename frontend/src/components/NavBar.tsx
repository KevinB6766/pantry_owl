"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function NavBar() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);

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

  return (
    <nav className="nav">
      <Link href="/" className="brand">🦉 Pantry Owl</Link>
      <div className="navlinks">
        <Link href="/list">My list</Link>
        {session ? (
          <>
            {(role === "admin" || role === "cashier" || role === "stocker") && <Link href="/staff">Staff tools</Link>}
            {role === "admin" && <Link href="/admin">Admin tools</Link>}
            <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          </>
        ) : (
          <Link href="/login">Sign in</Link>
        )}
      </div>
    </nav>
  );
}
