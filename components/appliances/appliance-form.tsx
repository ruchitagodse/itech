"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { applianceTypes, validateAppliance, type ApplianceInput, type ApplianceRecord, type ApplianceErrors } from "@/lib/appliances/data";
const empty: ApplianceInput = { type: "water_purifier", brand: "", model: "", serialNumber: "", purchaseDate: "", installationDate: "", notes: "", active: true };
export function ApplianceForm({ customerId, customerName, appliance }: { customerId: string; customerName: string; appliance?: ApplianceRecord }) {
  const [values, setValues] = useState<ApplianceInput>(appliance ?? empty);
  const [errors, setErrors] = useState<ApplianceErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const base = "/admin/customers/" + customerId + "/appliances";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const result = validateAppliance(values); setErrors(result.errors);
    if (!result.data) return;
    setBusy(true);
    try {
      const response = await fetch("/api/customers/" + customerId + "/appliances" + (appliance ? "/" + appliance.id : ""), {
        method: appliance ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data),
      });
      const payload = await response.json();
      if (!response.ok) { setErrors(payload.errors ?? {}); throw new Error(payload.error || "Could not save the appliance."); }
      router.push(base + "/" + payload.id + "?saved=1"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save the appliance."); setBusy(false); }
  }
  return <section className="provision-panel customer-form-panel"><form className="provision-form" onSubmit={submit} noValidate>
    <div className="provision-intro"><h2>Appliance details</h2><p className="muted">Customer: {customerName}</p></div>
    {error && <div className="message error" role="alert">{error}</div>}
    <div className="provision-fields">
      <div className="field"><label htmlFor="appliance-type">Appliance type</label><select id="appliance-type" value={values.type} disabled={busy} onChange={event => setValues({ ...values, type: event.target.value as ApplianceInput["type"] })}>{Object.entries(applianceTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{errors.type && <p className="field-error">{errors.type}</p>}</div>
      <div className="field"><label htmlFor="appliance-active">Record status</label><select id="appliance-active" value={values.active ? "active" : "inactive"} disabled={busy} onChange={event => setValues({ ...values, active: event.target.value === "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      {(["brand", "model", "serialNumber", "purchaseDate", "installationDate"] as const).map(key => {
        const labels = { brand: "Brand", model: "Model", serialNumber: "Serial number (optional)", purchaseDate: "Purchase date (optional)", installationDate: "Installation date (optional)" };
        return <div className="field" key={key}><label htmlFor={"appliance-" + key}>{labels[key]}</label><input id={"appliance-" + key} type={key.endsWith("Date") ? "date" : "text"} maxLength={key === "brand" ? 80 : 100} required={key === "brand" || key === "model"} value={values[key]} disabled={busy} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? key + "-error" : undefined} onChange={event => setValues({ ...values, [key]: event.target.value })} />{errors[key] && <p className="field-error" id={key + "-error"}>{errors[key]}</p>}</div>;
      })}
      <div className="field full-width"><label htmlFor="appliance-notes">Notes (optional)</label><textarea id="appliance-notes" rows={3} maxLength={1000} value={values.notes} disabled={busy} aria-invalid={Boolean(errors.notes)} onChange={event => setValues({ ...values, notes: event.target.value })} />{errors.notes && <p className="field-error">{errors.notes}</p>}</div>
    </div>
    <div className="provision-note"><strong>Serial number</strong><p>If available, enter the serial number from the appliance label. Brand and serial combinations must be unique, including inactive records. Spaces in serial numbers are removed and letters are saved in uppercase.</p></div>
    <div className="provision-actions"><button className="button primary" disabled={busy} type="submit">{busy ? "Saving appliance…" : appliance ? "Save changes" : "Add appliance"}</button><Link className="text-button" href={appliance ? base + "/" + appliance.id : base}>Cancel</Link></div>
  </form></section>;
}
