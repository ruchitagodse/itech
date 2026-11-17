import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCustomer } from "@/lib/customers/server";
import { listAppliances } from "@/lib/appliances/server";
import { ApplianceList, AppliancePagination } from "@/components/appliances/appliance-list";
export const metadata = { title: "Customer appliances" };
export default async function CustomerAppliancesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cursor?: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;
  const customer = await getCustomer(profile, id);
  if (!customer) notFound();
  const cursor = (await searchParams).cursor;
  const safeCursor = typeof cursor === "string" ? cursor : "";
  const { items, nextCursor } = await listAppliances(profile, id, safeCursor);
  const basePath = "/admin/customers/" + id + "/appliances";
  return <><Link className="text-button" href={"/admin/customers/" + id}>← Customer details</Link><div className="page-heading customer-heading"><div><span className="eyebrow">APPLIANCE MANAGEMENT</span><h1>Appliances<span className="welcome-dot">.</span></h1><p className="muted">{customer.fullName}</p></div><Link className="button primary" href={basePath + "/new"}>+ Add appliance</Link></div><div className="appliance-list-space"><ApplianceList items={items} basePath={basePath} canManage /></div><AppliancePagination nextCursor={nextCursor} cursor={safeCursor} basePath={basePath} /></>;
}
