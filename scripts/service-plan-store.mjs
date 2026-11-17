import { period, validPolicy, scheduleRows, scheduleId, indiaDate } from "./lifecycle-policy.mjs";
import { periodVisit } from "./maintenance-visits.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { applianceRef, validPlanDate } from "./service-plan-core.mjs";
export class PlanStoreError extends Error { constructor(code) { super(code); this.code = code; } }
const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export async function createAppliancePlan(db, customerId, applianceId, input, operatorUid, { managed = true } = {}) {
  if (!validId(customerId) || !validId(applianceId) || !validId(operatorUid) || !input
    || typeof input.name !== "string" || !input.name.trim() || input.name.length > 100
    || !validPlanDate(input.startsOn) || !validPlanDate(input.expiresOn) || input.expiresOn < input.startsOn
    || input.packageId !== null && !validId(input.packageId)
    || input.expectedLatestPlanId !== null && !validId(input.expectedLatestPlanId)) throw new PlanStoreError("invalid");
  const parent = applianceRef(db, customerId, applianceId), reference = parent.collection("servicePlans").doc();
  const stateRef = parent.collection("servicePlanState").doc("latest");
  await db.runTransaction(async tx => {
    const [actor, customer, appliance, state, source] = await Promise.all([
      tx.get(db.doc("users/" + operatorUid)), tx.get(db.doc("customers/" + customerId)), tx.get(parent), tx.get(stateRef),
      input.packageId ? tx.get(db.doc("servicePackages/" + input.packageId)) : Promise.resolve(null),
    ]);
    if (actor.data()?.role !== "admin" || actor.data()?.active !== true) throw new PlanStoreError("forbidden");
    if (!customer.exists || !appliance.exists) throw new PlanStoreError("not-found");
    if (customer.data().active !== true || appliance.data().active !== true) throw new PlanStoreError("inactive");
    const latestId = state.data()?.latestPlanId ?? null;
    if (latestId !== input.expectedLatestPlanId) throw new PlanStoreError("conflict");
    const latest = latestId ? await tx.get(parent.collection("servicePlans").doc(latestId)) : null;
    if (latestId && !latest?.exists) throw new PlanStoreError("conflict");
    if (latest && input.startsOn <= latest.data().expiresOn) throw new PlanStoreError("overlap");
    if (input.packageId && (!source.exists || source.data().active !== true || source.data().serviceType !== "maintenance" || source.data().applianceType !== appliance.data().type)) throw new PlanStoreError("package-unavailable");
    let dates = { startsOn: input.startsOn, expiresOn: input.expiresOn };
    let dueDates = [];
    if (managed) {
      if (latestId) throw new PlanStoreError("approval-required");
      if (!source?.exists || !validPolicy(source.data().policy)) throw new PlanStoreError("policy-required");
      if (!validPlanDate(appliance.data().installationDate) || appliance.data().installationDate > indiaDate()) throw new PlanStoreError("installation-required");
      try { ({ dueDates, ...dates } = period(appliance.data().installationDate, source.data().policy)); }
      catch (error) { if (error.code === "schedule-conflict") throw new PlanStoreError("schedule-conflict"); throw error; }
    }
    tx.create(reference, {
      name: input.packageId ? source.data().name : input.name.trim(), packageId: input.packageId,
      ...dates, totalServices: 2, usedServices: 0, renewedFrom: latestId,
      createdAt: FieldValue.serverTimestamp(), createdBy: operatorUid, updatedAt: FieldValue.serverTimestamp(), updatedBy: operatorUid,
    });
    if (managed) for (const row of scheduleRows({ ...dates, dueDates, planId: reference.id, customerId, applianceId, name: source.data().name, customerName: customer.data().fullName, applianceLabel: appliance.data().brand + " " + appliance.data().model })) {
      const visitId = scheduleId(reference.id, row.visit);
      tx.create(db.doc("maintenanceSchedule/" + visitId), row);
      tx.create(reference.collection("maintenanceVisits").doc(visitId), periodVisit(row, operatorUid));
    }
    tx.set(stateRef, { latestPlanId: reference.id });
  });
  return reference.id;
}
