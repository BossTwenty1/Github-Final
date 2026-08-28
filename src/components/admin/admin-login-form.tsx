"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { localSupabaseConfig, getBrowserSupabase } from "@/lib/supabase/config";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { BrandLockup } from "@/components/brand-lockup";
import { getAuthFlowType, restoreSessionFromAuthUrl } from "@/lib/auth-client";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ title: string; copy: string; variant: "danger" | "info" }>({ title: "", copy: "", variant: "info" });

  useEffect(() => {
    const flowType = getAuthFlowType();
    if (flowType !== "invite" && flowType !== "recovery" && flowType !== "password_setup") return;

    let active = true;
    void (async () => {
      if (active && await restoreSessionFromAuthUrl()) router.replace("/auth/set-password");
    })();
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage({ title: "", copy: "", variant: "info" });
    if (!email.trim() || !password) {
      setMessage({ title: "Check your details", copy: "Enter the administrator email and password to continue.", variant: "danger" });
      return;
    }
    const client = getBrowserSupabase();
    if (!client) {
      setMessage({ title: "Supabase is not configured", copy: "Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the frontend.", variant: "info" });
      return;
    }
    setBusy(true);
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setMessage({ title: "Unable to sign in", copy: "The credentials were not accepted, or the local Auth service is unavailable.", variant: "danger" });
      return;
    }
    router.push("/admin");
  }

  return <main className="admin-login-page"><div className="admin-login-card"><Link href="/" aria-label="Back to GraveNav home"><BrandLockup /></Link><div className="admin-login-heading"><div className="badge-row"><Badge icon="shield" variant="info">Protected workspace</Badge><Badge variant="info">{localSupabaseConfig.environmentLabel}</Badge></div><h1>Administrator sign in</h1><p>Use a Supabase Auth account with an active ADMIN or MANAGER role.</p></div><Card><CardHeader><CardTitle className="card-title-with-icon"><Icon className="text-green" name="shield" size={22} />Sign in to GraveNav</CardTitle></CardHeader><CardContent><form className="admin-form" onSubmit={submit}><Input autoComplete="username" label="Email address" onChange={(event) => setEmail(event.target.value)} placeholder="name@example.test" type="email" value={email} /><Input autoComplete="current-password" label="Password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" type="password" value={password} /><Button className="button--full" disabled={busy} icon="shield" size="lg" type="submit">{busy ? "Signing in..." : "Sign in"}</Button>{message.copy ? <Alert icon={message.variant === "danger" ? "alert" : "info"} title={message.title} variant={message.variant}>{message.copy}</Alert> : null}</form></CardContent></Card><p className="admin-login-footnote">Visitor search remains available without an account. Account creation and first-admin bootstrap are intentionally protected workflows.</p>{!localSupabaseConfig.configured ? <p className="admin-login-config">Supabase Auth is not configured. Add the public Supabase variables to .env.local, then restart the frontend.</p> : null}</div></main>;
}
