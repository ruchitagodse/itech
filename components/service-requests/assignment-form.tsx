"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ServiceRequestRecord } from "@/lib/service-requests/data";
import type { TechnicianOption, TechnicianDirectory } from "@/lib/assignments/data";
export function AssignmentForm({ item, initialTechnicians, initialError = "" }: { item: ServiceRequestRecord; initialTechnicians?: TechnicianDirectory; initialError?: string }) {
  const [options, setOptions] = useState<TechnicianOption[]>(initialTechnicians?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(initialTechnicians?.nextCursor ?? null);
  const [loaded, setLoaded] = useState(Boolean(initialTechnicians));
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(item.assignedTechnicianUid ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const router = useRouter();
  async function loadMore() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/technicians" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""), { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load technicians.");
      setOptions(previous => [...new Map([...previous, ...payload.items].map((value: TechnicianOption) => [value.uid, value])).values()]);
      setCursor(payload.nextCursor); setLoaded(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load technicians."); }
    finally { setLoading(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess(""); setBusy(true);
    try {
      const response = await fetch("/api/service-requests/" + item.id + "/assignment", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technicianUid: selected || null, expectedVersion: item.assignmentVersion }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save assignment.");
      setSuccess("Assignment saved."); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save assignment."); }
    finally { setBusy(false); }
  }
  const currentListed = options.some(option => option.uid === item.assignedTechnicianUid);
  return <section className="provision-panel"><form className="provision-form" onSubmit={submit}>
    <div className="provision-intro"><h2>Technician assignment</h2><p className="muted">{item.status === "in_progress" ? "Assign a technician to this unassigned In-progress request. Its status will stay unchanged." : "Assign, reassign or remove a technician while this request is Pending. This does not change the service status."}</p></div>
    {error && <div className="message error" role="alert">{error}</div>}{success && <div className="message success" role="status">{success}</div>}
    <div className="field"><label htmlFor="assigned-technician">Technician</label><select id="assigned-technician" value={selected} disabled={busy || loading} onChange={event => setSelected(event.target.value)}>
      <option value="">Unassigned</option>{item.assignedTechnicianUid && !currentListed && <option value={item.assignedTechnicianUid}>{item.assignedTechnicianName || "Current technician"} (current)</option>}
      {options.map(option => <option key={option.uid} value={option.uid}>{option.displayName} · {option.email}</option>)}
    </select><p className="muted">Only active, verified and enabled Technician accounts are available.</p></div>
    {(!loaded || cursor) && <button className="button secondary" type="button" disabled={busy || loading} onClick={loadMore}>{loading ? "Loading technicians…" : loaded ? "Load more technicians" : "Load technicians"}</button>}
    {loaded && !options.length && <div className="message" role="status">{cursor ? "No eligible technicians on this page. Load more to continue." : "No eligible technicians found. Create and verify a Technician account first."}</div>}
    <div className="provision-actions"><button className="button primary" disabled={busy || loading || selected === (item.assignedTechnicianUid ?? "")} type="submit">{busy ? "Saving assignment…" : "Save assignment"}</button></div>
  </form></section>;
}
