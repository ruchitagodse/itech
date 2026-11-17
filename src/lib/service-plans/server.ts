import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { Profile } from "@/lib/roles";
import { adminServices } from "@/lib/firebase/admin";
import { getAppliance, customerAppliances } from "@/lib/appliances/server";
import { validId } from "@/lib/service-requests/data";
import { PlanStoreError, createAppliancePlan } from "../../../scripts/service-plan-store.mjs";
import { indiaDate, planBalance, type PlanInput, type PlanRecord } from "./data";
export { PlanStoreError };
function record(doc: DocumentSnapshot): PlanRecord {
  const data = doc.data()!;
  return { id: doc.id, name: data.name, startsOn: data.startsOn, expiresOn: data.expiresOn, packageId: data.packageId, renewedFrom: data.renewedFrom, totalServices: data.totalServices, usedServices: data.usedServices, createdAt: data.createdAt?.toDate().toISOString() ?? "", ...planBalance(data as PlanRecord) };
}
export async function listAppliancePlans(profile: Profile, customerId: string, applianceId: string, cursor = "") {
  const appliance = await getAppliance(profile, customerId, applianceId);
  if (!appliance) throw new PlanStoreError("not-found");
  if (cursor && !validId(cursor)) throw new PlanStoreError("invalid");
  const root = adminServices().db.doc("customers/" + customerId + "/appliances/" + applianceId);
  const collection = root.collection("servicePlans");
  let query = collection.orderBy("startsOn", "desc");
  if (cursor) { const marker = await collection.doc(cursor).get(); if (!marker.exists) throw new PlanStoreError("invalid"); query = query.startAfter(marker); }
  const [page, current, upcoming, state] = await Promise.all([
    query.limit(26).get(),
    collection.where("startsOn", "<=", indiaDate()).orderBy("startsOn", "desc").limit(1).get(),
    collection.where("startsOn", ">", indiaDate()).orderBy("startsOn", "asc").limit(1).get(),
    root.collection("servicePlanState").doc("latest").get(),
  ]);
  const latestId = state.data()?.latestPlanId;
  const latest = latestId ? await collection.doc(latestId).get() : null;
  const items = page.docs.slice(0, 25).map(record);
  return { appliance, items, current: current.empty ? null : record(current.docs[0]), upcoming: upcoming.empty ? null : record(upcoming.docs[0]), latest: latest?.exists ? record(latest) : null, nextCursor: page.size > 25 ? items[items.length - 1].id : null };
}
export async function persistPlan(profile: Profile, customerId: string, applianceId: string, input: PlanInput) {
  if (profile.role !== "admin") throw new PlanStoreError("forbidden");
  return createAppliancePlan(adminServices().db, customerId, applianceId, input, profile.uid, { managed: true });
}

export async function ownPlanOverview(profile: Profile, cursor = "") {
  if (profile.role !== "customer") throw new PlanStoreError("forbidden");
  const { customer,items: appliances,nextCursor } = await customerAppliances(profile,cursor);
  if (!customer) return { customer: null,items: [],nextCursor: null };
  const db = adminServices().db;
  const items = await Promise.all(appliances.map(async appliance => {
    const plans = db.doc("customers/" + customer.id + "/appliances/" + appliance.id).collection("servicePlans");
    const [current,upcoming] = await Promise.all([
      plans.where("startsOn","<=",indiaDate()).orderBy("startsOn","desc").limit(1).get(),
      plans.where("startsOn",">",indiaDate()).orderBy("startsOn","asc").limit(1).get(),
    ]);
    return { appliance,current: current.empty ? null : record(current.docs[0]),upcoming: upcoming.empty ? null : record(upcoming.docs[0]) };
  }));
  return { customer,items,nextCursor };
}
