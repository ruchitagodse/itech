"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { serviceTypes, validateServiceRequest, type ServiceType, type RequestErrors } from "@/lib/service-requests/data";
export function RequestForm({ customerId, applianceId, customerName, applianceLabel, basePath, initialType = "maintenance", freeBooking = false }: { customerId: string; applianceId: string; customerName: string; applianceLabel: string; basePath: string; initialType?: ServiceType; freeBooking?: boolean }) {
  const [serviceType, setType] = useState<ServiceType>(initialType);
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<RequestErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const result = validateServiceRequest({ customerId, applianceId, serviceType, description, useIncludedVisit: freeBooking && serviceType === "maintenance" });
    setErrors(result.errors); if (!result.data) return;
    setBusy(true);
    try {
      const response = await fetch("/api/service-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data) });
      const payload = await response.json();
      if (!response.ok) { setErrors(payload.errors ?? {}); throw new Error(payload.error || "Could not submit the request."); }
      router.push(basePath + "/" + payload.id + "?saved=1"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not submit the request."); setBusy(false); }
  }
  return <section className="provision-panel customer-form-panel"><form className="provision-form" onSubmit={submit} noValidate>
    <div className="provision-intro"><h2>{applianceLabel}</h2><p className="muted">Customer: {customerName}</p></div>
    {freeBooking && serviceType === "maintenance" && <div className="message">You are requesting an included maintenance visit. Availability is checked again on submission; one visit is used only after completion within the plan dates.</div>}
    {serviceType === "repair" && <div className="message">Describe your complaint or fault below. Complaints do not use your free maintenance allowance.</div>}
    {error && <div className="message error" role="alert">{error}</div>}
    <div className="field"><label htmlFor="request-type">Service type</label><select id="request-type" value={serviceType} disabled={busy || freeBooking || initialType === "repair"} onChange={event => setType(event.target.value as ServiceType)}>{Object.entries(serviceTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{errors.serviceType && <p className="field-error">{errors.serviceType}</p>}</div>
    <div className="field"><label htmlFor="request-description">What do you need help with?</label><textarea id="request-description" rows={5} minLength={10} maxLength={2000} required value={description} disabled={busy} aria-invalid={Boolean(errors.description)} aria-describedby="description-help" onChange={event => setDescription(event.target.value)} /><p id="description-help" className={errors.description ? "field-error" : "muted"}>{errors.description ?? "Describe the issue or installation requirements in 10–2,000 characters."}</p></div>
    <div className="provision-note"><strong>What happens next?</strong><p>Your administrator will review this request. Submitting a request does not confirm an appointment. One open request per appliance and service type is allowed. An available maintenance plan is linked automatically; a visit is counted only on completion within its validity. Installation never uses a maintenance visit.</p></div>
    <div className="provision-actions"><button type="submit" className="button primary" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button><Link className="text-button" href={basePath}>Cancel</Link></div>
  </form></section>;
}
