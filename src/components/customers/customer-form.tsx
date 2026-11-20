"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { validateCustomer, type CustomerInput, type CustomerRecord, type CustomerErrors } from "@/lib/customers/data";
import { Icon } from "@/components/admin-dashboard/icons";
import s from "@/components/admin-customers/customers.module.css";
const empty: CustomerInput = { fullName: "", email: "", phone: "", alternatePhone: "", address: "", city: "", state: "", pincode: "", active: true };
const personalFields = [["fullName", "Full name", "text", "name"], ["email", "Email address", "email", "email"], ["phone", "Phone number", "tel", "tel"], ["alternatePhone", "Alternate phone (optional)", "tel", "off"]] as const;
const addressFields = [["city", "City", "text", "address-level2"], ["state", "State", "text", "address-level1"], ["pincode", "Pincode", "text", "postal-code"]] as const;
type Field = typeof personalFields[number] | typeof addressFields[number];
export function CustomerForm({ customer }: { customer?: CustomerRecord }) {
  const [values, setValues] = useState<CustomerInput>(customer ?? empty);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter(), form = useRef<HTMLFormElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const result = validateCustomer(values); setErrors(result.errors);
    if (!result.data) {
      const first = Object.keys(result.errors)[0];
      form.current?.querySelector<HTMLElement>("#customer-" + first)?.focus();
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(customer ? "/api/customers/" + customer.id : "/api/customers", {
        method: customer ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data),
      });
      const payload = await response.json();
      if (!response.ok) { setErrors(payload.errors ?? {}); throw new Error(payload.error || "Could not save the customer."); }
      router.push("/admin/customers/" + payload.id + "?saved=1"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save the customer."); setBusy(false); }
  }
  function field([key, label, type, autoComplete]: Field) {
    return <div className={s.field} key={key}><label htmlFor={"customer-" + key}>{label}{key !== "alternatePhone" && <span aria-hidden="true"> *</span>}</label><input id={"customer-" + key} name={key} type={type} autoComplete={autoComplete} inputMode={key === "pincode" ? "numeric" : undefined} maxLength={key === "email" ? 254 : key === "phone" || key === "alternatePhone" ? 25 : key === "pincode" ? 6 : 100} value={values[key]} disabled={busy} required={key !== "alternatePhone"} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? key + "-error" : undefined} onChange={event => setValues({ ...values, [key]: event.target.value })}/>{errors[key] && <p className={s.fieldError} id={key + "-error"}>{errors[key]}</p>}</div>;
  }
  return <form ref={form} className={s.customerForm} onSubmit={submit} noValidate aria-busy={busy}>
    <div className={s.formMain}>
      {error && <div className={s.error} role="alert">{error}</div>}
      {Object.keys(errors).length > 0 && <div className={s.validationSummary} role="alert">Check the highlighted fields before saving.</div>}
      <section className={s.panel}><div className={s.panelHeading}><div><h2><Icon name="customers"/>Personal information</h2><p>Contact details help your team provide connected care.</p></div><span className={s.requiredNote}>* Required</span></div><div className={s.formFields}>{personalFields.map(field)}</div><p className={s.panelNote}>Phone numbers accept 10 digits or the +91 country code. Email and primary phone must be unique, including inactive customer records.</p></section>
      <section className={s.panel}><div className={s.panelHeading}><div><h2><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/></svg>Service address</h2><p>The customer’s address for service coordination</p></div></div><div className={s.formFields}><div className={`${s.field} ${s.fullWidth}`}><label htmlFor="customer-address">Address <span aria-hidden="true">*</span></label><textarea id="customer-address" name="address" autoComplete="street-address" maxLength={500} rows={3} value={values.address} disabled={busy} required aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "address-error" : undefined} onChange={event => setValues({ ...values, address: event.target.value })}/>{errors.address && <p className={s.fieldError} id="address-error">{errors.address}</p>}</div>{addressFields.map(field)}</div></section>
      <section className={s.panel}><div className={s.panelHeading}><div><h2><Icon name="check"/>Customer record status</h2><p>Keep the directory up to date.</p></div></div><div className={s.statusField}><div className={s.field}><label htmlFor="customer-status">Record status</label><select id="customer-status" value={values.active ? "active" : "inactive"} disabled={busy} onChange={event => setValues({ ...values, active: event.target.value === "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div><p>This controls the customer record only. It does not change the sign-in account or appliance status.</p></div></section>
      <div className={s.formActions}><span>Review the customer details before saving.</span><div><Link className={s.outline} href={customer ? "/admin/customers/" + customer.id : "/admin/customers"} aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }}>Cancel</Link><button className={s.primary} type="submit" disabled={busy}>{busy ? "Saving customer…" : customer ? "Save changes" : "Add customer"}</button></div></div>
    </div>
    <aside className={s.formAside}><div className={s.panel}><div className={s.asideContent}><span className={s.accountIcon}><Icon name="plan"/></span><h3>Connected to the right account</h3><p>Use the customer’s sign-in email to link an existing Customer account. This form does not create or change sign-in accounts.</p>{customer?.ownerUid && <p className={s.linkedNote}><Icon name="check"/>Customer account already linked</p>}<div className={s.asideDivider}/><strong>Customer privacy</strong><p>Passwords and authentication data are managed separately. Contact changes do not transfer an existing account link.</p></div></div></aside>
  </form>;
}
