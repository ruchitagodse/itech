"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RequestStatus } from "@/lib/service-requests/data";
import type { WorkAction, WorkRecord } from "@/lib/technician-work/data";
export function TechnicianWorkForm({ id, status, work }: { id: string; status: RequestStatus; work: WorkRecord }) {
  const [notes, setNotes] = useState(work.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  async function update(action: WorkAction) {
    setError(""); setSuccess("");
    if (action === "complete" && !notes.trim()) { setError("Add service notes before completing work."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/technician/assignments/" + id + "/work", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes, expectedVersion: work.version, expectedStatus: status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update work.");
      setSuccess("Work updated."); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update work."); }
    finally { setBusy(false); }
  }
  return <section className="provision-panel"><div className="provision-form"><div className="provision-intro"><h2>Work update</h2><p className="muted">Service notes are visible to you and Admins. Customers can view progress.</p></div>
    {error && <div className="message error" role="alert">{error}</div>}{success && <div className="message success" role="status">{success}</div>}
    <div className="field"><label htmlFor="service-notes">Service notes{status === "in_progress" ? " (required to complete)" : " (optional)"}</label><textarea id="service-notes" rows={4} maxLength={2000} disabled={busy} value={notes} onChange={event => setNotes(event.target.value)} /><p className="muted">Maximum 2,000 characters.</p></div>
    <div className="provision-actions">{status === "pending" ? <button className="button primary" disabled={busy} onClick={() => update("start")}>Start work</button> : <><button className="button secondary" disabled={busy} onClick={() => update("save_notes")}>Save notes</button><button className="button primary" disabled={busy} onClick={() => update("complete")}>Complete work</button></>}</div>
  </div></section>;
}
