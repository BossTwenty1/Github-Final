"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandLockup } from "@/components/brand-lockup";
import { getBrowserSupabase, localSupabaseConfig } from "@/lib/supabase/config";

export function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The password confirmation does not match.");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Supabase is not configured. Restart the frontend after setting the public Supabase variables.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError("The password could not be saved. Please reopen the invitation link and try again.");
      return;
    }

    const response = await fetch("/api/auth/complete", { method: "POST" });
    const result = await response.json() as { destination?: string; error?: string };
    if (result.destination) {
      window.location.assign(result.destination);
      return;
    }
    if (!response.ok || !result.destination) {
      setBusy(false);
      setError(result.error || "Your password was saved, but the GraveNav account could not be verified.");
      return;
    }
  }

  return <main className="admin-login-page"><div className="admin-login-card"><Link href="/" aria-label="Back to GraveNav home"><BrandLockup /></Link><div className="admin-login-heading"><div className="badge-row"><Badge icon="shield" variant="info">Protected workspace</Badge><Badge variant="info">{localSupabaseConfig.environmentLabel}</Badge></div><h1>Set your GraveNav password</h1><p>Finish setting up your invited account before entering the protected workspace.</p></div><Card><CardHeader><CardTitle>Choose a password</CardTitle></CardHeader><CardContent><form className="admin-form" onSubmit={submit}><Input autoComplete="new-password" label="New password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /><Input autoComplete="new-password" label="Confirm password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />{error ? <Alert icon="alert" title="Password setup unavailable" variant="danger">{error}</Alert> : null}<Button className="button--full" disabled={busy} icon="shield" size="lg" type="submit">{busy ? "Saving password…" : "Set password"}</Button></form></CardContent></Card><p className="admin-login-footnote">Your password is handled by Supabase Auth. Visitors can continue using public GraveNav search without an account.</p></div></main>;
}
