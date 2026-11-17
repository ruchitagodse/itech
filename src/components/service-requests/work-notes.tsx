import type { WorkRecord } from "@/lib/technician-work/data";
export function WorkNotes({ work }: { work: WorkRecord }) {
  return <section className="customer-details-panel"><dl className="customer-details appliance-details"><div className="full-width"><dt>Service notes</dt><dd>{work.notes || "No service notes yet."}</dd></div>{work.updatedAt && <div><dt>Notes updated (IST)</dt><dd>{new Date(work.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</dd></div>}</dl></section>;
}
