"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { validateCustomer, type CustomerInput, type CustomerRecord, type CustomerErrors } from "@/lib/customers/data";
const empty: CustomerInput = { fullName: "", email: "", phone: "", alternatePhone: "", address: "", city: "", state: "", pincode: "", active: true };
const fields = [
  ["fullName", "Full name", "text", "name"], ["email", "Email", "email", "email"],
  ["phone", "Phone number", "tel", "tel"], ["alternatePhone", "Alternate phone (optional)", "tel", "off"],
  ["city", "City", "text", "address-level2"], ["state", "State", "text", "address-level1"],
  ["pincode", "Pincode", "text", "postal-code"],
] as const;
export function CustomerForm({ customer }: { customer?: CustomerRecord }) {
  const [values, setValues] = useState<CustomerInput>(customer ?? empty);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const result = validateCustomer(values); setErrors(result.errors);
    if (!result.data) return;
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
  return <section className="provision-panel customer-form-panel"><form className="provision-form" onSubmit={submit} noValidate>
    <div className="provision-intro"><h2>Customer information</h2><p className="muted">Use the customer’s sign-in email to link an existing Customer account. This form does not create or change sign-in accounts.</p></div>
    {error && <div className="message error" role="alert">{error}</div>}
    <div className="provision-fields">
      {fields.map(([key, label, type, autoComplete]) => <div className="field" key={key}><label htmlFor={"customer-" + key}>{label}</label><input id={"customer-" + key} name={key} type={type} autoComplete={autoComplete} inputMode={key === "pincode" ? "numeric" : undefined} maxLength={key === "email" ? 254 : key === "phone" || key === "alternatePhone" ? 25 : key === "pincode" ? 6 : 100} value={values[key]} disabled={busy} required={key !== "alternatePhone"} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? key + "-error" : undefined} onChange={event => setValues({ ...values, [key]: event.target.value })} />{errors[key] && <p className="field-error" id={key + "-error"}>{errors[key]}</p>}</div>)}
      <div className="field"><label htmlFor="customer-status">Record status</label><select id="customer-status" value={values.active ? "active" : "inactive"} disabled={busy} onChange={event => setValues({ ...values, active: event.target.value === "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select><small className="muted">This status does not change the sign-in account.</small></div>
      <div className="field full-width"><label htmlFor="customer-address">Address</label><textarea id="customer-address" autoComplete="street-address" maxLength={500} rows={3} value={values.address} disabled={busy} required aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "address-error" : undefined} onChange={event => setValues({ ...values, address: event.target.value })} />{errors.address && <p className="field-error" id="address-error">{errors.address}</p>}</div>
    </div>
    <div className="provision-note"><strong>Unique contact details</strong><p>Email and primary phone must be unique, including inactive records. Phone numbers accept 10 digits or the +91 country code. Names may be shared.</p></div>
    <div className="provision-actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Saving customer…" : customer ? "Save changes" : "Add customer"}</button><Link className="text-button" href={customer ? "/admin/customers/" + customer.id : "/admin/customers"}>Cancel</Link></div>
  </form></section>;
}
