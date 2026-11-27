"use client";
import { useState, type FormEvent } from "react";
type AccountRole = "technician" | "customer";
export function CreateAccountForm() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AccountRole>("technician");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; role: AccountRole } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setCreated(null);
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create the account.");
      setCreated({ email: data.account.email, role: data.account.role });
      setEmail(""); setDisplayName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account. Please try again.");
    } finally { setBusy(false); }
  }
  return <section className="provision-panel" aria-label="Create account">
    <form className="provision-form" onSubmit={submit}>
      <div className="provision-intro"><h2>Account details</h2><p className="muted">Use an email address the account holder can access.</p></div>
      {created && <div className="message success" role="status"><strong>{created.role === "technician" ? "Technician" : "Customer"} account created</strong><p>{created.email}</p><p>Ask the user to open the sign-in page and choose <strong>Forgot password</strong> to set their password. They must also complete email verification before accessing their dashboard.</p></div>}
      {error && <div className="message error" role="alert">{error}</div>}
      <div className="provision-fields">
        <div className="field"><label htmlFor="account-name">Full name</label><input id="account-name" autoComplete="name" maxLength={100} placeholder="Enter full name" value={displayName} onChange={e => setDisplayName(e.target.value)} required disabled={busy} /></div>
        <div className="field"><label htmlFor="account-email">Email address</label><input id="account-email" type="email" autoComplete="email" maxLength={254} placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} /></div>
      </div>
      <fieldset className="role-options" disabled={busy}><legend>Account role</legend><div className="role-option-grid">
        <label className={"role-option" + (role === "technician" ? " selected" : "")}><input type="radio" name="account-role" value="technician" checked={role === "technician"} onChange={() => setRole("technician")} /><span><strong>Technician</strong><small>Access to the Technician workspace.</small></span></label>
        <label className={"role-option" + (role === "customer" ? " selected" : "")}><input type="radio" name="account-role" value="customer" checked={role === "customer"} onChange={() => setRole("customer")} /><span><strong>Customer</strong><small>Access to the Customer workspace.</small></span></label>
      </div></fieldset>
      <div className="provision-note"><strong>Password setup</strong><p>Passwords are set privately by the account holder through the sign-in page. No password is displayed or shared here.</p></div>
      <div className="provision-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button><span className="muted">Your Admin session stays signed in.</span></div>
    </form>
  </section>;
}
