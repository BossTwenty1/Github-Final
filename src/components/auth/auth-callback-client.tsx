"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { localSupabaseConfig } from "@/lib/supabase/config";
import { getAuthFlowType, restoreSessionFromAuthUrl } from "@/lib/auth-client";

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function finishAuth() {
      const isPasswordSetup = isPasswordSetupType(getAuthFlowType() || searchParams.get("type")?.toLowerCase());
      if (!await restoreSessionFromAuthUrl()) {
        if (active) setError(true);
        return;
      }

      if (isPasswordSetup) {
        window.history.replaceState({}, document.title, "/auth/callback");
        router.replace("/auth/set-password");
      } else {
        router.replace("/");
      }
    }

    void finishAuth();
    return () => { active = false; };
  }, [router, searchParams]);

  return <main className="admin-login-page"><div className="admin-login-card"><div className="admin-login-heading"><h1>{error ? "Sign-in link unavailable" : "Finishing secure sign-in"}</h1><p>{error ? "This link is invalid or expired. Request a new password recovery email or invitation." : "Please wait while GraveNav verifies your session."}</p></div>{error ? <p className="admin-login-config">{localSupabaseConfig.environmentLabel} authentication could not be completed.</p> : null}</div></main>;
}

function isPasswordSetupType(value: string | undefined) {
  return value === "invite" || value === "recovery" || value === "password_setup";
}
