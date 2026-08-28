"use client";

import { getBrowserSupabase } from "./supabase/config";

export async function signOut() {
  const supabase = getBrowserSupabase();
  if (!supabase) return { error: new Error("Supabase is not configured") };
  return supabase.auth.signOut();
}

export async function restoreSessionFromAuthUrl() {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;

  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (hash.has("error")) return false;

  const code = query.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return false;
  } else {
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) return false;
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  return Boolean(session);
}

export function getAuthFlowType() {
  const queryType = new URLSearchParams(window.location.search).get("type")?.toLowerCase();
  const hashType = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type")?.toLowerCase();
  return queryType || hashType || "";
}
