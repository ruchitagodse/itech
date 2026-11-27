"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { validatePlan, indiaDate, nextDay, type PlanRecord } from "@/lib/service-plans/data";
import { period } from "../../../scripts/lifecycle-policy.mjs";
import type { ServicePackageRecord } from "@/lib/service-packages/data";
export function PlanForm({ customerId, applianceId, applianceType, installationDate, latest }: { customerId: string; applianceId: string; applianceType: string; installationDate: string; latest: PlanRecord | null }) {
  const start = latest ? nextDay(latest.expiresOn) : installationDate || indiaDate();
  const [values,setValues] = useState({ name: latest?.name ?? "2 free maintenance services", startsOn: start, expiresOn: start, packageId: null as string | null, expectedLatestPlanId: latest?.id ?? null });
  const [packages,setPackages] = useState<ServicePackageRecord[]>([]);
  const [packageCursor,setPackageCursor] = useState<string | null>(null);
  const [packagesLoaded,setPackagesLoaded] = useState(false);
  const [loadingPackages,setLoadingPackages] = useState(false);
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  const router = useRouter(), base = "/admin/customers/" + customerId + "/appliances/" + applianceId;
  async function loadPackages() {
    setLoadingPackages(true); setError("");
    try {
      const response = await fetch("/api/service-packages" + (packageCursor ? "?cursor=" + encodeURIComponent(packageCursor) : ""), { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load packages.");
      const eligible = result.items.filter((item: ServicePackageRecord) => item.active && item.applianceType === applianceType && item.serviceType === "maintenance" && item.policy);
      setPackages(previous => [...new Map([...previous,...eligible].map((item: ServicePackageRecord) => [item.id,item])).values()]);
      setPackageCursor(result.nextCursor); setPackagesLoaded(true);
    } catch(err) { setError(err instanceof Error ? err.message : "Could not load packages."); }
    finally { setLoadingPackages(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!installationDate || !values.packageId || latest) { setError("Record installation and choose a configured package. Renewals require customer agreement in Service lifecycle."); return; }
    const input = validatePlan(values);
    if (!input) { setError("Enter a name and valid dates. Expiry cannot be before the start date."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/customers/" + customerId + "/appliances/" + applianceId + "/service-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the plan.");
      router.push(base + "?planSaved=1"); router.refresh();
    } catch(err) { setError(err instanceof Error ? err.message : "Could not save the plan."); setBusy(false); }
  }
  return <section className="provision-panel"><form className="provision-form" onSubmit={submit} noValidate><div className="provision-intro"><h2>{latest ? "Renew service plan" : "Appliance service plan"}</h2><p className="muted">Two free maintenance visits, apart from installation. Unused visits expire and do not carry forward.</p></div>
    {!installationDate && <p className="message error">Record the actual installation date in Edit appliance first.</p>}{latest && <Link className="button secondary" href={"/admin/lifecycle?customerId="+customerId+"&applianceId="+applianceId}>Propose renewal for customer agreement</Link>}
    {error && <div className="message error" role="alert">{error}</div>}
    <div className="field"><label htmlFor="source-package">Maintenance package (required)</label><select id="source-package" disabled={busy || loadingPackages} value={values.packageId ?? ""} onChange={event => { const selected = packages.find(item => item.id === event.target.value); let dates = null; try { dates = selected?.policy ? period(start,selected.policy) : null; } catch { setError("This package does not allow both visits within validity at its configured frequency. Extend package validity before creating a plan."); return; } setValues({...values,packageId:selected?.id ?? null,name:selected?.name ?? values.name,startsOn:start,expiresOn:dates?.expiresOn ?? start}); }}><option value="">Select a configured package</option>{packages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="muted">Validity and maintenance interval come from this package. Initial validity begins on the recorded installation date; the server calculates expiry.</p></div>
    {(!packagesLoaded || packageCursor) && <button type="button" className="button secondary" onClick={loadPackages} disabled={busy || loadingPackages}>{loadingPackages ? "Loading…" : packagesLoaded ? "Load more packages" : "Load maintenance packages"}</button>}
    {packagesLoaded && !packages.length && <p className="muted">{packageCursor ? "No matching maintenance packages on this page. Load more to find a configured package." : "No matching active maintenance package. Configure a package validity before creating a plan."}</p>}
    <div className="provision-fields"><div className="field full-width"><label htmlFor="plan-name">Plan name</label><input id="plan-name" value={values.name} maxLength={100} required disabled={busy || Boolean(values.packageId)} onChange={event=>setValues({...values,name:event.target.value})} /></div>
    <div className="field"><label htmlFor="plan-start">Valid from</label><input type="date" id="plan-start" value={values.startsOn} required disabled readOnly onChange={event=>setValues({...values,startsOn:event.target.value})} /></div>
    <div className="field"><label htmlFor="plan-expiry">Valid through (inclusive)</label><input type="date" id="plan-expiry" value={values.expiresOn} required disabled readOnly onChange={event=>setValues({...values,expiresOn:event.target.value})} /></div></div>
    <div className="provision-note"><strong>2 included maintenance services</strong><p>A completed maintenance request during this period uses one visit. Installation and cancellation use none. Renewal creates a separate period after the latest expiry.</p>{latest && <p>Latest period ends {latest.expiresOn}. The new period must start later.</p>}</div>
    <div className="provision-actions"><button type="submit" className="button primary" disabled={busy || loadingPackages || !installationDate || !values.packageId || Boolean(latest)}>{busy ? "Saving…" : latest ? "Create renewal period" : "Add service plan"}</button><Link className="text-button" href={base}>Cancel</Link></div>
  </form></section>;
}
