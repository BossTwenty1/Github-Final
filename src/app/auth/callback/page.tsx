import { Suspense } from "react";
import { AuthCallbackClient } from "@/components/auth/auth-callback-client";

export default function AuthCallbackPage() {
  return <Suspense fallback={<main className="admin-login-page"><div className="admin-login-card"><p className="admin-login-config">Finishing secure sign-in…</p></div></main>}><AuthCallbackClient /></Suspense>;
}
