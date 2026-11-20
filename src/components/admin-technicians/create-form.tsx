"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/admin-dashboard/icons";
import { validateTechnicianInput } from "@/lib/admin-technicians/data";
import c from "@/components/admin-customers/customers.module.css";
import s from "./technicians.module.css";
export function TechnicianCreateForm() {
  const [displayName, setName] = useState(""), [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ displayName?: string; email?: string }>({});
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ uid: string; email: string } | null>(null);
  const nameInput = useRef<HTMLInputElement>(null), emailInput = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const validation = validateTechnicianInput(displayName, email); setErrors(validation);
    if (Object.keys(validation).length) { (validation.displayName ? nameInput : emailInput).current?.focus(); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: displayName.trim(), email: email.trim(), role: "technician" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create the account.");
      setCreated({ uid: data.account.uid, email: data.account.email }); setName(""); setEmail("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create the account. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className={c.customerForm}><div className={c.formMain}>{created && <section className={`${c.panel} ${s.created}`} role="status"><span className={c.accountIcon}><Icon name="check"/></span><h2>Technician account created</h2><p>{created.email}</p><p>The account holder must use Forgot password on the sign-in page to set their password and complete email verification before accessing their workspace.</p><Link className={c.secondary} href={"/admin/technicians/" + encodeURIComponent(created.uid)}>View technician</Link></section>}
    <form onSubmit={submit} noValidate aria-busy={busy} className={c.formMain}>
      {error && <div className={c.error} role="alert">{error}</div>}
      {Object.keys(errors).length > 0 && <div className={c.validationSummary} role="alert">Check the highlighted account details before continuing.</div>}
      <section className={c.panel}><div className={c.panelHeading}><div><h2><Icon name="team"/>Technician account details</h2><p>Create access to the existing Technician workspace.</p></div></div><div className={c.formFields}>
        <div className={c.field}><label htmlFor="technician-name">Full name <span aria-hidden="true">*</span></label><input ref={nameInput} id="technician-name" name="displayName" autoComplete="name" maxLength={100} value={displayName} onChange={e => setName(e.target.value)} required disabled={busy} aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? "technician-name-error" : undefined}/>{errors.displayName && <p className={c.fieldError} id="technician-name-error">{errors.displayName}</p>}</div>
        <div className={c.field}><label htmlFor="technician-email">Email address <span aria-hidden="true">*</span></label><input ref={emailInput} id="technician-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "technician-email-error" : undefined}/>{errors.email && <p className={c.fieldError} id="technician-email-error">{errors.email}</p>}</div>
      </div><div className={s.roleNote}><span className={c.iconTile}><Icon name="plan"/></span><div><strong>Technician role</strong><p>Access is assigned by the existing account-creation workflow.</p></div><span className={`${c.badge} ${c.neutral}`}>Technician</span></div><p className={c.panelNote}>Use an email address the technician can access. Existing accounts are never replaced or linked by this form.</p></section>
      <div className={c.formActions}><span>Fields marked * are required.</span><div><Link className={c.outline} href="/admin/technicians" aria-disabled={busy} onClick={e => { if (busy) e.preventDefault(); }}>Cancel</Link><button type="submit" className={c.primary} disabled={busy}>{busy ? "Creating technician…" : "Add technician"}</button></div></div>
    </form></div><aside className={c.formAside}><section className={c.panel}><div className={c.asideContent}><span className={c.accountIcon}><Icon name="plan"/></span><h3>A private account setup</h3><p>Passwords are set privately by the account holder through the sign-in page. No password is displayed or shared here.</p><div className={c.asideDivider}/><strong>Email verification</strong><p>New accounts start unverified. The technician must complete verification before signing in and becoming eligible for assignment.</p><div className={c.asideDivider}/><strong>Your Admin session stays signed in</strong><p>The existing account-creation service provisions the new technician without switching your account.</p></div></section></aside></div>;
}
