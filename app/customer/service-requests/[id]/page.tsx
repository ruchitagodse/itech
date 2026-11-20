import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getServiceRequest } from "@/lib/service-requests/server";
import { CustomerRequestTracker } from "@/components/customer-requests/customer-request-tracker";

export const metadata = { title: "Service request tracking" };

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const profile = await requireRole("customer");
  const id = (await params).id;
  const item = await getServiceRequest(profile, id);
  if (!item) notFound();

  const saved = (await searchParams).saved === "1";

  return <CustomerRequestTracker item={item} saved={saved} />;
}
