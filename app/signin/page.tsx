"use client";

import { createBrowserClient } from "@supabase/ssr";
import { FormEvent, useState } from "react";
import "../manual.css";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createBrowserClient(url, key) : null;
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function emailSignIn(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const supabase = getSupabase();
    if (!supabase) { setMessage("Sign-in is not configured for this deployment."); setLoading(false); return; }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setMessage(error ? error.message : "Check your email for a secure sign-in link."); setLoading(false);
  }

  async function googleSignIn() {
    setLoading(true); setMessage("");
    const supabase = getSupabase();
    if (!supabase) { setMessage("Sign-in is not configured for this deployment."); setLoading(false); return; }
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setMessage(error.message); setLoading(false); }
  }

  return <main className="signin-page"><section className="signin-brand"><img src="/ilma-logo.png" alt="Ilma llama logo"/><div className="eyebrow">AI-assisted opportunity prioritization</div><h1>Ilma&apos;s Route to Revenue</h1><p>Score every opportunity consistently and know exactly where to focus next.</p></section><section className="signin-card"><h2>Welcome back</h2><p>Sign in with any email address or Google account.</p><button className="google-button" onClick={googleSignIn} disabled={loading}><span>G</span> Continue with Google</button><div className="signin-divider"><span>or use email</span></div><form onSubmit={emailSignIn}><label>Email address<input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email"/></label><button className="signin-submit" disabled={loading || !email}>{loading ? "Signing in…" : "Email me a sign-in link"}</button></form>{message && <div className="signin-message" role="status">{message}</div>}<small>By continuing, you acknowledge this is a concept system containing no real data or information.</small></section></main>;
}
