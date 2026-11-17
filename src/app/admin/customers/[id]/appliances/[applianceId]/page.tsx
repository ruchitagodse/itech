import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getAppliance } from "@/lib/appliances/server";
import { AppliancePlans } from "@/components/service-plans/appliance-plans";
import { ApplianceDetails } from "@/components/appliances/appliance-details";
import { applianceTypes } from "@/lib/appliances/data";
export const metadata = { title: "Appliance details" };
export default async function AppliancePage({ params, searchParams }: { params: Promise<{ id: string; applianceId: string }>; searchParams: Promise<{ saved?: string; planSaved?: string; planCursor?: string }> }) {
  const profile = await requireRole("admin");
  const { id, applianceId } = await params;
  const appliance = await getAppliance(profile, id, applianceId);
  if (!appliance) notFound();
  const query = await searchParams;
  const base = "/admin/customers/" + id + "/appliances";
  return <><Link className="text-button" href={base}>← Customer appliances</Link><div className="page-heading customer-heading"><div><span className="eyebrow">APPLIANCE DETAILS</span><h1>{appliance.brand} {appliance.model}<span className="welcome-dot">.</span></h1><p className="muted">{applianceTypes[appliance.type]}</p></div><Link className="button primary" href={base + "/" + appliance.id + "/edit"}>Edit appliance</Link></div>{query.saved === "1" && <div className="message success customer-success" role="status">Appliance saved successfully.</div>}{query.planSaved === "1" && <div className="message success customer-success" role="status">Service plan saved. Previous periods are preserved.</div>}<ApplianceDetails appliance={appliance} /><AppliancePlans profile={profile} customerId={id} applianceId={appliance.id} cursor={typeof query.planCursor === "string" ? query.planCursor : ""} /><div className="profile-actions"><Link className="button secondary" href={"/admin/service-requests/new?customerId=" + id + "&applianceId=" + appliance.id}>Request service</Link></div></>;
}
