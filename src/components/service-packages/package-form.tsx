"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { applianceTypes } from "@/lib/appliances/data";
import { serviceTypes } from "@/lib/service-requests/data";
import { validatePackage, type ServicePackageRecord, type PackageDraft, type PackageErrors } from "@/lib/service-packages/data";
const empty: PackageDraft = { name: "", applianceType: "water_purifier", serviceType: "maintenance", price: "", description: "", active: true, policy: { validityMonths: 0, maintenanceIntervalMonths: 6 } };
export function PackageForm({ item }: { item?: ServicePackageRecord }) {
  const [values,setValues] = useState<PackageDraft>(item ? { name: item.name, applianceType: item.applianceType, serviceType: item.serviceType, price: (item.pricePaise / 100).toFixed(2), description: item.description, active: item.active, policy: item.policy ?? { validityMonths: 0, maintenanceIntervalMonths: 6 } } : empty);
  const [errors,setErrors] = useState<PackageErrors>({});
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const draft = values.serviceType === "maintenance" ? values : { ...values, policy: undefined };
    const result = validatePackage(draft); setErrors(result.errors);
    if (!result.data) return;
    setBusy(true);
    try {
      const response = await fetch("/api/service-packages" + (item ? "/" + item.id : ""), {
        method: item ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, expectedVersion: item?.version }),
      });
      const payload = await response.json();
      if (!response.ok) { setErrors(payload.errors ?? {}); throw new Error(payload.error || "Could not save the package."); }
      router.push("/admin/service-packages?saved=1"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save the package."); setBusy(false); }
  }
  return <section className="provision-panel customer-form-panel"><form className="provision-form" onSubmit={submit} noValidate>
    <div className="provision-intro"><h2>Package details</h2><p className="muted">Active packages appear in the Customer catalogue.</p></div>
    {error && <div className="message error" role="alert">{error}</div>}
    <div className="provision-fields">
      <div className="field full-width"><label htmlFor="package-name">Package name</label><input id="package-name" required maxLength={100} value={values.name} disabled={busy} aria-invalid={Boolean(errors.name)} onChange={event=>setValues({...values,name:event.target.value})} />{errors.name && <p className="field-error">{errors.name}</p>}</div>
      <div className="field"><label htmlFor="package-appliance">Appliance type</label><select id="package-appliance" value={values.applianceType} disabled={busy} onChange={event=>setValues({...values,applianceType:event.target.value as PackageDraft["applianceType"]})}>{Object.entries(applianceTypes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>{errors.applianceType && <p className="field-error">{errors.applianceType}</p>}</div>
      <div className="field"><label htmlFor="package-service">Service type</label><select id="package-service" value={values.serviceType} disabled={busy} onChange={event=>setValues({...values,serviceType:event.target.value as PackageDraft["serviceType"]})}>{Object.entries(serviceTypes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>{errors.serviceType && <p className="field-error">{errors.serviceType}</p>}</div>
      <div className="field"><label htmlFor="package-price">Price (INR)</label><input id="package-price" inputMode="decimal" required maxLength={10} placeholder="e.g. 499.00" value={values.price} disabled={busy} aria-invalid={Boolean(errors.price)} onChange={event=>setValues({...values,price:event.target.value})} />{errors.price && <p className="field-error">{errors.price}</p>}</div>
      <div className="field"><label htmlFor="package-active">Status</label><select id="package-active" value={values.active?"active":"inactive"} disabled={busy} onChange={event=>setValues({...values,active:event.target.value==="active"})}><option value="active">Active</option><option value="inactive">Inactive</option></select>{errors.active && <p className="field-error">{errors.active}</p>}</div>
      {values.serviceType === "maintenance" && <><div className="field"><label htmlFor="validity-months">Plan validity (months)</label><input id="validity-months" type="number" min={1} max={120} required value={values.policy?.validityMonths || ""} disabled={busy} onChange={event=>setValues({...values,policy:{validityMonths:Number(event.target.value),maintenanceIntervalMonths:values.policy?.maintenanceIntervalMonths ?? 6}})} />{errors.policy && <p className="field-error">{errors.policy}</p>}</div>
      <div className="field"><label htmlFor="maintenance-months">Maintenance interval (months)</label><input id="maintenance-months" type="number" min={1} max={60} required value={values.policy?.maintenanceIntervalMonths ?? 6} disabled={busy} onChange={event=>setValues({...values,policy:{validityMonths:values.policy?.validityMonths ?? 0,maintenanceIntervalMonths:Number(event.target.value)}})} /></div></>}
      <div className="field full-width"><label htmlFor="package-description">Description</label><textarea id="package-description" rows={4} required maxLength={1000} value={values.description} disabled={busy} aria-invalid={Boolean(errors.description)} onChange={event=>setValues({...values,description:event.target.value})} />{errors.description && <p className="field-error">{errors.description}</p>}</div>
    </div>
    <div className="provision-actions"><button className="button primary" disabled={busy} type="submit">{busy?"Saving…":item?"Save changes":"Add package"}</button><Link className="text-button" href="/admin/service-packages">Cancel</Link></div>
  </form></section>;
}
