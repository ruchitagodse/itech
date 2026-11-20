import "server-only";
import type { Profile } from "@/lib/roles";
import { adminServices } from "@/lib/firebase/admin";
import { CustomerAccessError, listCustomers } from "@/lib/customers/server";
import { getCustomer } from "@/lib/customers/server";
import { listAppliances } from "@/lib/appliances/server";
import { listAppliancePlans } from "@/lib/service-plans/server";
import { serviceRequestRecord } from "@/lib/service-requests/server";
import { indiaDate, planBalance } from "@/lib/service-plans/data";
import { directoryFilters, filteredDirectory, type Relationships, type DirectoryFilter } from "./projections";
function admin(profile: Profile) { if (profile.role !== "admin") throw new CustomerAccessError(403); }
async function optional<T>(read: () => Promise<T>): Promise<T | null> { try { return await read(); } catch { return null; } }
export async function customerDirectory(profile: Profile, query: string, cursor: string, filter: string) {
  admin(profile);
  const selected: DirectoryFilter = directoryFilters.includes(filter as DirectoryFilter) ? filter as DirectoryFilter : "all";
  const db = adminServices().db;
  const [customers, appliances, plans, pending] = await Promise.all([
    db.collection("customers").select("active").get(),
    optional(() => db.collectionGroup("appliances").select("active").get()),
    optional(() => db.collectionGroup("servicePlans").select("startsOn", "expiresOn", "totalServices", "usedServices").get()),
    optional(() => db.collection("serviceRequests").where("status", "==", "pending").select("customerId").get()),
  ]);
  const summaries = new Map<string, Relationships>(customers.docs.map(c => [c.id, { appliances: appliances ? 0 : null, activeAppliances: appliances ? 0 : null, activePlans: plans ? 0 : null, pendingRequests: pending ? 0 : null }]));
  for (const a of appliances?.docs ?? []) {
    // Only the existing customers/{id}/appliances/{id} relationship is valid.
    if (!/^customers\/[^/]+\/appliances\/[^/]+$/.test(a.ref.path)) continue;
    const summary = summaries.get(a.ref.parent.parent!.id);
    if (summary) { summary.appliances!++; if (a.data().active === true) summary.activeAppliances!++; }
  }
  const today = indiaDate();
  for (const p of plans?.docs ?? []) {
    if (!/^customers\/[^/]+\/appliances\/[^/]+\/servicePlans\/[^/]+$/.test(p.ref.path)) continue;
    const summary = summaries.get(p.ref.path.split("/")[1]), data = p.data();
    if (summary && planBalance({ startsOn: data.startsOn, expiresOn: data.expiresOn, totalServices: data.totalServices, usedServices: data.usedServices }, today).status === "active") summary.activePlans!++;
  }
  for (const r of pending?.docs ?? []) { const summary = summaries.get(r.data().customerId); if (summary) summary.pendingRequests!++; }
  if (selected === "plans" && !plans || selected === "pending" && !pending) throw new Error("Relationship filter is temporarily unavailable.");
  const relationship = (id: string): Relationships => summaries.get(id) ?? { appliances: null, activeAppliances: null, activePlans: null, pendingRequests: null };
  const page = await filteredDirectory(after => listCustomers(profile, query, after), selected, relationship, cursor);
  const countWith = (field: keyof Relationships) => [...summaries.values()].filter(s => (s[field] ?? 0) > 0).length;
  return { ...page, items: page.items.map(c => ({ ...c, relationships: relationship(c.id) })), selected,
    metrics: { total: customers.size, appliances: appliances ? countWith("activeAppliances") : null, plans: plans ? countWith("activePlans") : null, pending: pending ? countWith("pendingRequests") : null } };
}
export async function adminCustomerDetails(profile: Profile, id: string) {
  admin(profile);
  const customer = await getCustomer(profile, id);
  if (!customer) return null;
  const db = adminServices().db;
  const [appliances, history] = await Promise.all([
    optional(() => listAppliances(profile, id)),
    optional(async () => (await db.collection("serviceRequests").where("customerId", "==", id).orderBy("createdAt", "desc").limit(6).get()).docs.map(serviceRequestRecord)),
  ]);
  const withPlans = appliances ? await Promise.all(appliances.items.map(async appliance => ({ appliance, plans: await optional(() => listAppliancePlans(profile, id, appliance.id)) }))) : null;
  return { customer, appliances: withPlans, moreAppliances: appliances?.nextCursor !== null, history };
}
export type DirectoryData = Awaited<ReturnType<typeof customerDirectory>>;
export type CustomerDetailData = NonNullable<Awaited<ReturnType<typeof adminCustomerDetails>>>;
