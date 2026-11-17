"use client";
import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { inMemoryPersistence, sendEmailVerification, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";
function errorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
    if (error.code === "auth/network-request-failed") return "Check your connection and try again.";
    if (error.code === "auth/invalid-email") return "Enter a valid email address.";
    if (error.code === "auth/unauthorized-domain" || error.code === "auth/operation-not-allowed") return "Sign-in is not configured. Contact your administrator.";
    return "Unable to sign in. Check your email and password and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
export function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verification, setVerification] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setVerification(false); setBusy(true);
    try {
      const auth = clientAuth();
      if (reset) {
        try { await sendPasswordResetEmail(auth, email.trim()); }
        catch (err) { if (!(err instanceof FirebaseError) || !["auth/user-not-found", "auth/invalid-credential"].includes(err.code)) throw err; }
        setNotice("If an account exists for this email, a password reset link has been sent.");
        return;
      }
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!credential.user.emailVerified) { setVerification(true); setNotice("Please verify your email before signing in. You can request a fresh verification email below."); return; }
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await credential.user.getIdToken(true) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await signOut(auth);
      window.location.assign(data.destination);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); setPassword(""); }
  }
  async function resend() {
    setBusy(true); setError(""); setNotice("");
    try {
      const auth = clientAuth();
      if (!auth.currentUser) throw new Error("Please sign in again to request verification.");
      await sendEmailVerification(auth.currentUser);
      await signOut(auth);
      setVerification(false);
      setNotice("Verification email sent. Open the link, then sign in again.");
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="auth-form">
    {!firebaseConfigured && <div className="message setup" role="status"><strong>Setup required</strong><br />Firebase is not configured yet. Follow README.md to connect a development project.</div>}
    {reset && <div className="message">Enter your account email and we’ll send you a password reset link.</div>}
    <div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} /></div>
    {!reset && <div className="field"><div className="label-row"><label htmlFor="password">Password</label><button className="text-button" type="button" disabled={busy} onClick={() => { setReset(true); setError(""); setNotice(""); setVerification(false); }}>Forgot password?</button></div><div className="password-field"><input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} /><button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button></div></div>}
    {error && <div className="message error" role="alert">{error}</div>}
    {notice && <div className="message success" role="status">{notice}</div>}
    <button className="button primary" disabled={busy || !firebaseConfigured} type="submit">{busy ? "Please wait…" : reset ? "Send reset link" : <>Sign in <span aria-hidden="true">→</span></>}</button>
    {verification && <button className="button secondary" type="button" disabled={busy} onClick={resend}>Send verification email</button>}
    {reset && <button className="text-button back-button" type="button" disabled={busy} onClick={() => { setReset(false); setError(""); setNotice(""); }}>← Back to sign in</button>}
  </form>;
}
