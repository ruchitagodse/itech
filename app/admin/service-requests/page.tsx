import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listServiceRequests } from "@/lib/service-requests/server";
import { requestStatuses, isStatus } from "@/lib/service-requests/data";
import { RequestList, RequestPagination } from "@/components/service-requests/request-list";
export const metadata = { title: "Service requests" };
export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; cursor?: string }> }) {
  const profile = await requireRole("admin");
  const query = await searchParams;
  const status = isStatus(query.status) ? query.status : "";
  const cursor = typeof query.cursor === "string" ? query.cursor : "";
  const { items, nextCursor } = await listServiceRequests(profile, status, cursor);
  const basePath = "/admin/service-requests";
  return <><div className="page-heading"><div><span className="eyebrow">SERVICE CARE</span><h1>Service requests<span className="welcome-dot">.</span></h1><p className="muted">Review requests and update their progress.</p></div><Link className="button primary" href="/admin/customers">Choose customer & appliance</Link></div>
  <form className="customer-search" action={basePath}><div className="field"><label htmlFor="filter-status">Filter by status</label><select name="status" id="filter-status" defaultValue={status}><option value="">All statuses</option>{Object.entries(requestStatuses).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div><button className="button secondary" type="submit">Apply filter</button>{status && <Link className="text-button" href={basePath}>Clear</Link>}</form>
  <RequestList items={items} basePath={basePath} /><RequestPagination basePath={basePath} cursor={cursor} nextCursor={nextCursor} status={status} /></>;
}
