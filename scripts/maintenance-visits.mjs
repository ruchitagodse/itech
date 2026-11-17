import { FieldValue } from "firebase-admin/firestore";
import { scheduleId } from "./lifecycle-policy.mjs";
import { ServiceRequestError } from "./service-errors.mjs";
const stamp = () => FieldValue.serverTimestamp();
export const planRoot = (db, customerId, applianceId, planId) =>
  db.doc("customers/" + customerId + "/appliances/" + applianceId + "/servicePlans/" + planId);
export const visitRoot = (db, request) =>
  planRoot(db, request.customerId, request.applianceId, request.servicePlanId).collection("maintenanceVisits").doc(request.visitId);
export function periodVisit(row, actorUid) {
  return { ...row, schemaVersion: 1, status: "scheduled", requestId: null,
    createdBy: actorUid, createdAt: stamp(), updatedBy: actorUid, updatedAt: stamp() };
}
// All reads finish before the caller invokes apply(). No dates are invented for legacy periods.
export async function prepareVisitBooking(tx, db, input, planId, requestId, actorUid) {
  const root = planRoot(db, input.customerId, input.applianceId, planId);
  const plan = await tx.get(root), data = plan.data();
  if (!data || data.totalServices !== 2 || !Number.isInteger(data.usedServices) || data.usedServices < 0 || data.usedServices > 2)
    throw new ServiceRequestError("plan-unavailable");
  const managed = data.schemaVersion >= 2;
  for (const number of [1, 2]) {
    const id = scheduleId(planId, number), ref = root.collection("maintenanceVisits").doc(id);
    const [visit, schedule] = await Promise.all([tx.get(ref), managed ? tx.get(db.doc("maintenanceSchedule/" + id)) : null]);
    const old = visit.data(), scheduled = schedule?.data();
    if (managed && (!scheduled || scheduled.customerId !== input.customerId || scheduled.applianceId !== input.applianceId || scheduled.planId !== planId))
      throw new ServiceRequestError("linkage-review-required");
    if (old && (old.customerId !== input.customerId || old.applianceId !== input.applianceId || old.planId !== planId))
      throw new ServiceRequestError("linkage-review-required");
    if (old?.status === "completed" || old?.requestId || scheduled?.status === "completed" || scheduled?.requestId
      || !old && number <= data.usedServices) continue;
    const row = { customerId: input.customerId, applianceId: input.applianceId, planId, visit: number,
      dueOn: scheduled?.dueOn ?? null, startsOn: data.startsOn, expiresOn: data.expiresOn };
    return {
      visitId: id,
      apply() {
        tx.set(ref, { ...(old ?? periodVisit(row, actorUid)), status: "requested", requestId, updatedBy: actorUid, updatedAt: stamp() });
        if (managed) tx.update(schedule.ref, { requestId, workflowStatus: "requested" });
      },
    };
  }
  throw new ServiceRequestError("plan-unavailable");
}
export async function prepareVisitState(tx, db, request, requestId, state, actorUid) {
  if (request.serviceType !== "maintenance" || !request.visitId || !request.servicePlanId) return () => {};
  const ref = visitRoot(db, request), snap = await tx.get(ref), data = snap.data();
  if (!data || data.requestId !== requestId || data.planId !== request.servicePlanId
    || data.customerId !== request.customerId || data.applianceId !== request.applianceId || data.status === "completed")
    throw new ServiceRequestError("linkage-review-required");
  const plan = await tx.get(planRoot(db, request.customerId, request.applianceId, request.servicePlanId));
  const managed = plan.data()?.schemaVersion >= 2;
  const schedule = managed ? await tx.get(db.doc("maintenanceSchedule/" + request.visitId)) : null;
  if (managed && (!schedule.exists || schedule.data().requestId !== requestId
    || schedule.data().planId !== request.servicePlanId || schedule.data().customerId !== request.customerId
    || schedule.data().applianceId !== request.applianceId)) throw new ServiceRequestError("linkage-review-required");
  const release = state === "scheduled";
  return () => {
    tx.update(ref, { status: state, requestId: release ? null : requestId, updatedBy: actorUid, updatedAt: stamp() });
    if (schedule) tx.update(schedule.ref, { workflowStatus: state, requestId: release ? null : requestId });
  };
}
