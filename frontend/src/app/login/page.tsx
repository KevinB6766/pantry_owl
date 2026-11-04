"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage(error.message);
    router.push("/");
  }

  async function signUp() {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return setMessage(error.message);
    if (data.session) router.push("/");
    else setMessage("Check your email to confirm your account, then sign in.");
  }

  return (
    <div className="stack">
      <h1>Sign in</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={signIn}>Sign in</button>
      <button onClick={signUp} style={{ background: "#fff", color: "#1a1a1a" }}>Create account</button>
      {message && <p className="error">{message}</p>}
    </div>
  );
}
