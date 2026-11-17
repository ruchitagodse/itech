import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getServiceRequest } from "@/lib/service-requests/server";
import { RequestDetails } from "@/components/service-requests/request-details";
import { serviceTypes } from "@/lib/service-requests/data";
export const metadata = { title: "Service request details" };
export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const profile = await requireRole("customer");
  const item = await getServiceRequest(profile, (await params).id);
  if (!item) notFound();
  return <><Link className="text-button" href="/customer/service-requests">← Service requests</Link><div className="page-heading customer-heading"><div><span className="eyebrow">REQUEST DETAILS</span><h1>{serviceTypes[item.serviceType]} request<span className="welcome-dot">.</span></h1><p className="muted">{item.applianceLabel}</p></div></div>
  {(await searchParams).saved === "1" && <div className="message success customer-success" role="status">Service request submitted successfully.</div>}
  <RequestDetails item={item} admin={false} /></>;
}
