"use client";
import { useState } from "react";
export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function logout() {
    setBusy(true); setError(false);
    try {
      const response = await fetch("/api/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.replace("/login");
    } catch { setError(true); setBusy(false); }
  }
  return <div><button className="logout-button" onClick={logout} disabled={busy}>{busy ? "Signing out…" : "↪  Sign out"}</button>{error && <p role="alert" className="logout-error">Could not sign out. Try again.</p>}</div>;
}
