import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ownCustomer } from "@/lib/customers/server";
import { getAppliance } from "@/lib/appliances/server";
import { AppliancePlans } from "@/components/service-plans/appliance-plans";
import { ApplianceDetails } from "@/components/appliances/appliance-details";
import { applianceTypes } from "@/lib/appliances/data";
export const metadata = { title: "My appliance" };
export default async function MyAppliancePage({ params, searchParams }: { params: Promise<{ applianceId: string }>; searchParams: Promise<{ planCursor?: string }> }) {
  const profile = await requireRole("customer");
  const customer = await ownCustomer(profile);
  if (!customer) notFound();
  const appliance = await getAppliance(profile, customer.id, (await params).applianceId);
  if (!appliance) notFound();
  const query = await searchParams;
  return <><Link className="text-button" href="/customer/appliances">← My appliances</Link><div className="page-heading customer-heading"><div><span className="eyebrow">YOUR APPLIANCE</span><h1>{appliance.brand} {appliance.model}<span className="welcome-dot">.</span></h1><p className="muted">{applianceTypes[appliance.type]} · Contact your administrator to request changes.</p></div></div><ApplianceDetails appliance={appliance} /><AppliancePlans profile={profile} customerId={customer.id} applianceId={appliance.id} cursor={typeof query.planCursor === "string" ? query.planCursor : ""} /><div className="profile-actions"><Link className="button primary" href={"/customer/service-requests/new?applianceId=" + appliance.id}>Request service</Link><Link className="button secondary" href={"/customer/service-requests/new?applianceId=" + appliance.id + "&serviceType=repair"}>Report a complaint</Link></div></>;
}
