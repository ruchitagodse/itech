import "server-only";
import { adminServices } from "@/lib/firebase/admin";
import type { Profile } from "@/lib/roles";
import { indiaDate, planBalance } from "../../../scripts/service-plan-dates.mjs";
import { plusDays } from "../../../scripts/lifecycle-policy.mjs";

// Read-only, Admin-only projections. A failed read is unavailable, never a zero.
export async function adminDashboard(profile: Profile) {
  if (profile.role !== "admin") throw new Error("Admin access required.");
  const db = adminServices().db, today = indiaDate();
  async function safe<T>(read: () => Promise<T>): Promise<T | null> {
    try { return await read(); } catch { return null; }
  }
  const count = (query: FirebaseFirestore.Query) => safe(async () => (await query.count().get()).data().count);
  const statuses = ["pending", "in_progress", "completed", "cancelled"] as const;
  const [customers, technicians, appliances, statusCounts, assigned, plans, maintenance, renewals, events, recent, settings] = await Promise.all([
    count(db.collection("customers")),
    count(db.collection("users").where("role", "==", "technician")),
    count(db.collectionGroup("appliances")),
    Promise.all(statuses.map(status => count(db.collection("serviceRequests").where("status", "==", status)))),
    safe(async () => (await db.collection("serviceRequests").where("status", "==", "pending").select("assignedTechnicianUid").get()).docs.filter(d => !!d.data().assignedTechnicianUid).length),
    // Shared planBalance keeps exhaustion and inclusive expiry semantics consistent.
    safe(async () => (await db.collectionGroup("servicePlans").select("startsOn", "expiresOn", "totalServices", "usedServices").get()).docs.map(d => d.data())),
    safe(async () => (await db.collection("maintenanceSchedule").where("status", "==", "due").where("dueOn", ">=", today).orderBy("dueOn").limit(5).get()).docs.map((d): { id: string } & FirebaseFirestore.DocumentData => ({ id: d.id, ...d.data() }))),
    Promise.all(["awaiting_customer", "agreed"].map(status => count(db.collection("renewals").where("status", "==", status)))),
    safe(async () => (await db.collection("serviceEvents").orderBy("createdAt", "desc").limit(5).get()).docs.map(d => d.data())),
    safe(async () => (await db.collection("serviceRequests").orderBy("createdAt", "desc").limit(5).get()).docs.map((d): { id: string } & FirebaseFirestore.DocumentData => ({ id: d.id, ...d.data() }))),
    safe(async () => (await db.doc("settings/serviceAutomation").get()).data()),
  ]);
  const leadDays = Number.isInteger(settings?.expiryLeadDays) ? settings!.expiryLeadDays : 0;
  const expired = plans === null ? null : plans.filter(p => p.expiresOn < today).length;
  return { today, customers, technicians, appliances, statuses: Object.fromEntries(statuses.map((s, i) => [s, statusCounts[i]])), assigned,
    activePlans: plans === null ? null : plans.filter(p => planBalance({ startsOn: String(p.startsOn), expiresOn: String(p.expiresOn), totalServices: Number(p.totalServices), usedServices: Number(p.usedServices) }, today).status === "active").length,
    expiring: plans === null ? null : plans.filter(p => p.startsOn <= today && p.expiresOn >= today && p.expiresOn <= plusDays(today, leadDays)).length,
    expired, leadDays, maintenance, awaitingCustomer: renewals[0], awaitingAdmin: renewals[1], events, recent };
}
export type AdminDashboardData = Awaited<ReturnType<typeof adminDashboard>>;




