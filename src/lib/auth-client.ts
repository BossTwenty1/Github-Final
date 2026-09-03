"use client";

import { getBrowserSupabase } from "./supabase/config";

export async function signOut() {
  const supabase = getBrowserSupabase();
  if (!supabase) return { error: new Error("Supabase is not configured") };
  return supabase.auth.signOut();
}

let authRestorePromise: Promise<boolean> | null = null;

export function restoreSessionFromAuthUrl() {
  authRestorePromise ??= restoreSessionFromAuthUrlOnce();
  return authRestorePromise;
}

async function restoreSessionFromAuthUrlOnce() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = query.get("code");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  // Remove one-time codes, bearer tokens, and error details before any async
  // exchange can fail or the browser can retain the callback URL in history.
  window.history.replaceState({}, document.title, window.location.pathname);

  const supabase = getBrowserSupabase();
  if (!supabase) return false;

  if (hash.has("error")) return false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return false;
  } else {
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
