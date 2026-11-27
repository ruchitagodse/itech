"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { nextStatuses, requestStatuses, type RequestStatus } from "@/lib/service-requests/data";
export function RequestStatusForm({ id, status, assignedTechnicianUid }: { id: string; status: RequestStatus; assignedTechnicianUid?: string | null }) {
  const choices = nextStatuses(status).filter(value => assignedTechnicianUid || (value !== "in_progress" && value !== "completed"));
  const [next, setNext] = useState<RequestStatus | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  if (!choices.length) return <div className="provision-note customer-success"><strong>This request is closed</strong><p>Completed and cancelled requests keep their original details and cannot be reopened. A new request can be created from the appliance.</p></div>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!next || !choices.includes(next)) { setError("Choose the next status."); return; }
    if (next === "completed" && !notes.trim()) { setError("Add service notes before completing work."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/service-requests/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next, expectedStatus: status, ...(next === "completed" ? { notes } : {}) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update status.");
      setSuccess("Status updated."); setNext(""); setNotes(""); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update status."); }
    finally { setBusy(false); }
  }
  return <section className="provision-panel"><form className="provision-form" onSubmit={submit}>
    <div className="provision-intro"><h2>Update status</h2><p className="muted">Only Admins can change progress. Completing or cancelling closes this request.</p></div>
    {!assignedTechnicianUid && <div className="message" role="status">Assign a technician before starting or completing this request.</div>}
    {error && <div className="message error" role="alert">{error}</div>}{success && <div className="message success" role="status">{success}</div>}
    <div className="field"><label htmlFor="request-status">Next status</label><select id="request-status" value={next} disabled={busy} required onChange={event => setNext(event.target.value as RequestStatus)}><option value="">Choose a status</option>{choices.map(value => <option key={value} value={value}>{requestStatuses[value]}</option>)}</select></div>
    {next === "completed" && <div className="field"><label htmlFor="admin-completion-notes">Service completion notes</label><textarea id="admin-completion-notes" required maxLength={2000} value={notes} disabled={busy} onChange={event => setNotes(event.target.value)} /><p className="muted">Describe the work completed. Notes are required for every completion.</p></div>}
    <button className="button primary" disabled={busy} type="submit">{busy ? "Updating…" : "Update status"}</button>
  </form></section>;
}
