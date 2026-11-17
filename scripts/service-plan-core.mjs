import { scheduleId } from "./lifecycle-policy.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { indiaDate, planBalance } from "./service-plan-dates.mjs";
import { visitRoot } from "./maintenance-visits.mjs";
import { ServiceRequestError } from "./service-errors.mjs";
export { indiaDate, validPlanDate, planBalance } from "./service-plan-dates.mjs";
export function applianceRef(db, customerId, applianceId) { return db.doc("customers/" + customerId + "/appliances/" + applianceId); }
export async function findIncludedPlan(tx, db, customerId, applianceId, serviceType) {
  if (serviceType !== "maintenance") return null;
  const today = indiaDate();
  const snapshot = await tx.get(applianceRef(db, customerId, applianceId).collection("servicePlans").where("startsOn", "<=", today).orderBy("startsOn", "desc").limit(1));
  const doc = snapshot.docs[0];
  if (!doc || planBalance(doc.data(), today).status !== "active") return null;
  return { servicePlanId: doc.id, servicePlanName: doc.data().name, servicePlanOutcome: "pending", servicePlanCreditUsed: false };
}
// Read first. The returned closure writes inside the same transaction as request completion.
export async function preparePlanCompletion(tx, db, request, requestId, actorUid) {
  if (request.serviceType !== "maintenance") return () => ({});
  if (!request.servicePlanId) {
    if (request.schemaVersion !== 3 || request.maintenanceCoverage !== "not_included")
      throw new ServiceRequestError("linkage-review-required");
    return () => ({ servicePlanOutcome: "not_included", servicePlanCreditUsed: false });
  }
  const planRef = applianceRef(db, request.customerId, request.applianceId).collection("servicePlans").doc(request.servicePlanId);
  const receiptRef = planRef.collection("visits").doc(requestId);
  const [plan, receipt] = await Promise.all([tx.get(planRef), tx.get(receiptRef)]);
  if (receipt.exists) return () => ({ servicePlanOutcome: "used", servicePlanCreditUsed: true });
  if (!plan.exists) throw new ServiceRequestError("linkage-review-required");
  const data = plan.data(), balance = planBalance(data);
  if (!Number.isInteger(data.usedServices) || data.usedServices < 0 || data.usedServices > 2 || data.totalServices !== 2)
    throw new ServiceRequestError("linkage-review-required");
  let visit, schedule;
  if (request.visitId) {
    visit = await tx.get(visitRoot(db, request));
    const v = visit.data();
    if (!v || v.requestId !== requestId || v.planId !== planRef.id || v.customerId !== request.customerId
      || v.applianceId !== request.applianceId || v.status === "completed" || request.visitId !== scheduleId(planRef.id, v.visit))
      throw new ServiceRequestError("linkage-review-required");
    if (data.schemaVersion >= 2) {
      schedule = await tx.get(db.doc("maintenanceSchedule/" + request.visitId));
      if (!schedule.exists || schedule.data().requestId !== requestId || schedule.data().status === "completed"
        || schedule.data().planId !== planRef.id || schedule.data().customerId !== request.customerId
        || schedule.data().applianceId !== request.applianceId) throw new ServiceRequestError("linkage-review-required");
    }
  } else if (request.schemaVersion === 3 || data.schemaVersion >= 2) {
    throw new ServiceRequestError("linkage-review-required");
  }
  if (balance.status !== "active") return () => {
    if (visit) tx.update(visit.ref, { status: "scheduled", requestId: null, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid });
    if (schedule) tx.update(schedule.ref, { workflowStatus: "scheduled", requestId: null });
    return { servicePlanOutcome: balance.status, servicePlanCreditUsed: false };
  };
  return () => {
    if (visit) tx.update(visit.ref, { status: "completed", requestId, completedAt: FieldValue.serverTimestamp(), updatedBy: actorUid, updatedAt: FieldValue.serverTimestamp() });
    if (schedule) tx.update(schedule.ref, { status: "completed", workflowStatus: "completed", requestId, completedAt: FieldValue.serverTimestamp(), completedBy: actorUid });
    tx.update(planRef, { usedServices: data.usedServices + 1, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid });
    tx.create(receiptRef, { requestId, ...(request.visitId ? { visitId: request.visitId } : {}), completedAt: FieldValue.serverTimestamp(), completedBy: actorUid });
    return { servicePlanOutcome: "used", servicePlanCreditUsed: true };
  };
}
