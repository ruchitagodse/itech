import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { customerAppliances } from "@/lib/appliances/server";
import { ApplianceList, AppliancePagination } from "@/components/appliances/appliance-list";
export const metadata = { title: "My appliances" };
export default async function MyAppliancesPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const profile = await requireRole("customer");
  const cursor = (await searchParams).cursor;
  const safeCursor = typeof cursor === "string" ? cursor : "";
  const { customer, items, nextCursor } = await customerAppliances(profile, safeCursor);
  return <><div className="page-heading"><div><span className="eyebrow">YOUR HOME</span><h1>My appliances<span className="welcome-dot">.</span></h1><p className="muted">Your water purifier and AC details. Contact your administrator to request changes.</p></div></div>{customer ? <><div className="appliance-list-space"><ApplianceList items={items} basePath="/customer/appliances" /></div><AppliancePagination nextCursor={nextCursor} cursor={safeCursor} basePath="/customer/appliances" /></> : <section className="customer-empty"><h2>Your profile is not linked yet</h2><p className="muted">Ask your administrator to link a customer record before adding your appliances.</p><Link className="button secondary" href="/customer/profile">My profile</Link></section>}</>;
}
