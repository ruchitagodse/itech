import { requireRole } from "@/lib/auth";
import { listAssignments } from "@/lib/assignments/server";
import { isStatus, requestStatuses } from "@/lib/service-requests/data";
import { RequestList, RequestPagination } from "@/components/service-requests/request-list";
export const metadata = { title: "My assigned work" };
export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ status?: string; cursor?: string }> }) {
  const profile = await requireRole("technician");
  const query = await searchParams;
  const status = isStatus(query.status) ? query.status : "";
  const cursor = typeof query.cursor === "string" ? query.cursor : "";
  const { items, nextCursor } = await listAssignments(profile, status, cursor);
  const basePath = "/technician/assignments";
  return <><div className="page-heading"><div><span className="eyebrow">YOUR WORK</span><h1>My assigned work<span className="welcome-dot">.</span></h1><p className="muted">Requests currently assigned to you. Open a request to start work, save service notes or mark it completed.</p></div></div>
    <form className="customer-search" action={basePath}><div className="field"><label htmlFor="assignment-status">Filter by status</label><select id="assignment-status" name="status" defaultValue={status}><option value="">All statuses</option>{Object.entries(requestStatuses).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></div><button className="button secondary" type="submit">Apply filter</button></form>
    <RequestList items={items} basePath={basePath} assignedOnly /><RequestPagination basePath={basePath} cursor={cursor} nextCursor={nextCursor} status={status} /></>;
}
