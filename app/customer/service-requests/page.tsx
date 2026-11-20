import { requireRole } from "@/lib/auth";
import { listServiceRequests } from "@/lib/service-requests/server";
import { isStatus } from "@/lib/service-requests/data";
import { CustomerRequestsView } from "@/components/customer-requests/customer-requests-view";

export const metadata = { title: "My services" };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const profile = await requireRole("customer");
  const query = await searchParams;
  const status = isStatus(query.status) ? query.status : "";
  const cursor = typeof query.cursor === "string" ? query.cursor : "";
  const { items, nextCursor } = await listServiceRequests(profile, status, cursor);

  return (
    <CustomerRequestsView
      items={items}
      basePath="/customer/service-requests"
      cursor={cursor}
      nextCursor={nextCursor}
      status={status}
    />
  );
}
