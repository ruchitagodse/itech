"use client";

import { useState } from "react";
import styles from "./profile.module.css";

export function ProfileLogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleLogout() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.replace("/login");
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className={styles.logoutButton}
        onClick={handleLogout}
        disabled={busy}
        aria-label="Sign out of your iTech account"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>{busy ? "Signing out…" : "Sign out of iTech"}</span>
      </button>
      {error && (
        <p role="alert" className={styles.logoutError}>
          Could not sign out. Please check your connection and try again.
        </p>
      )}
    </div>
  );
}
