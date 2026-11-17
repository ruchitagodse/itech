import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ownPlanOverview } from "@/lib/service-plans/server";
import { AppliancePagination } from "@/components/appliances/appliance-list";
export const metadata = { title: "My service plans" };
export default async function MyServicePlansPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const profile = await requireRole("customer");
  const query = await searchParams, cursor = typeof query.cursor === "string" ? query.cursor : "";
  const { customer,items,nextCursor } = await ownPlanOverview(profile,cursor);
  return <><div className="page-heading"><div><span className="eyebrow">YOUR INCLUDED CARE</span><h1>My service plans<span className="welcome-dot">.</span></h1><p className="muted">Your appliance plans, remaining maintenance visits and expiry. Complaints are separate from included maintenance.</p></div><Link className="button secondary" href="/customer/service-requests">My services</Link></div>
    {!customer ? <section className="customer-empty"><h2>Your profile is not linked yet</h2><p className="muted">Contact your administrator to link your customer record and appliances.</p></section> : !items.length ? <section className="customer-empty"><h2>No appliances added yet</h2><p className="muted">Your administrator can add appliances and their included service plans.</p></section> : <div className="plan-overview">{items.map(({appliance,current,upcoming})=>{
      const plan = current ?? upcoming;
      const canRequest = customer.active && appliance.active;
      const canBook = canRequest && current?.status === "active" && current.remainingServices > 0;
      return <article className="customer-details-panel" key={appliance.id}><div className="section-heading"><h2>{appliance.brand} {appliance.model}</h2><Link className="text-button" href={"/customer/appliances/"+appliance.id}>Details &amp; plan history →</Link></div>
        {plan ? <><dl className="customer-details"><div><dt>My plan / package</dt><dd>{plan.name}</dd></div><div><dt>Status</dt><dd>{plan.status === "active" ? "Active" : plan.status === "expired" ? "Expired" : plan.status === "upcoming" ? "Upcoming" : "All visits used"}</dd></div><div><dt>Valid through (inclusive)</dt><dd>{plan.expiresOn}</dd></div><div><dt>Included maintenance services</dt><dd>{plan.totalServices}</dd></div><div><dt>Used</dt><dd>{plan.usedServices}</dd></div><div><dt>{plan.status === "upcoming" ? "Available when period starts" : "Remaining"}</dt><dd>{plan.status === "upcoming" ? plan.totalServices-plan.usedServices : plan.remainingServices}</dd></div></dl>{current && upcoming && <p className="muted plan-note">Renewal scheduled from {upcoming.startsOn} through {upcoming.expiresOn}, with {upcoming.totalServices} new visits.</p>}</> : <p className="muted">No service plan is attached to this appliance. You can still report a complaint.</p>}
        <div className="profile-actions">{canBook && <Link className="button primary" href={"/customer/service-requests/new?applianceId="+appliance.id+"&serviceType=maintenance&free=1"}>Book free maintenance</Link>}{canRequest ? <Link className="button secondary" href={"/customer/service-requests/new?applianceId="+appliance.id+"&serviceType=repair"}>Report a complaint</Link> : <p className="muted">This record is inactive. Contact your administrator before requesting service.</p>}</div>
      </article>;
    })}</div>}
    {customer && <AppliancePagination cursor={cursor} nextCursor={nextCursor} basePath="/customer/service-plans" />}
  </>;
}
