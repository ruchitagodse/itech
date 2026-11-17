import { recordServiceEvent } from "./lifecycle-events.mjs";
import { findIncludedPlan, preparePlanCompletion } from "./service-plan-core.mjs";
import { prepareVisitBooking, prepareVisitState } from "./maintenance-visits.mjs";
import { requireCompletionNotes } from "./completion-notes.mjs";
import { ServiceRequestError } from "./service-errors.mjs";
export { ServiceRequestError };
import { FieldValue } from "firebase-admin/firestore";
const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const types = ["installation", "maintenance", "repair"];
const transitions = { pending: ["in_progress", "cancelled"], in_progress: ["completed", "cancelled"], completed: [], cancelled: [] };
// Hash-free length-safe components with an unambiguous delimiter: underscores can occur in IDs,
// so encode each component by length to prevent collisions between different customer/appliance pairs.
export function keyFor(data) { return data.customerId.length + "-" + data.customerId + "-" + data.applianceId.length + "-" + data.applianceId + "-" + data.serviceType; }
export async function createServiceRequest(db, input, actorUid) {
  if (!validId(actorUid) || !validId(input?.customerId) || !validId(input?.applianceId)
    || !types.includes(input.serviceType) || typeof input.description !== "string"
    || input.useIncludedVisit !== undefined && typeof input.useIncludedVisit !== "boolean" || input.useIncludedVisit === true && input.serviceType !== "maintenance"
    || input.description.trim().length < 10 || input.description.trim().length > 2000) throw new ServiceRequestError("invalid");
  const reference = db.collection("serviceRequests").doc();
  const key = db.collection("serviceRequestKeys").doc(keyFor(input));
  await db.runTransaction(async tx => {
    const [actor, customer, appliance, reservation] = await Promise.all([
      tx.get(db.doc("users/" + actorUid)), tx.get(db.doc("customers/" + input.customerId)),
      tx.get(db.doc("customers/" + input.customerId + "/appliances/" + input.applianceId)), tx.get(key),
    ]);
    const role = actor.data()?.role;
    if (actor.data()?.active !== true || !["admin", "customer"].includes(role)
      || role === "customer" && customer.data()?.ownerUid !== actorUid) throw new ServiceRequestError("forbidden");
    if (!customer.exists || !appliance.exists) throw new ServiceRequestError("not-found");
    if (customer.data().active !== true || appliance.data().active !== true) throw new ServiceRequestError("inactive");
    if (reservation.exists) throw new ServiceRequestError("duplicate");
    const includedPlan = await findIncludedPlan(tx, db, input.customerId, input.applianceId, input.serviceType);
    if (input.useIncludedVisit === true && !includedPlan) throw new ServiceRequestError("plan-unavailable");
    const booking = includedPlan ? await prepareVisitBooking(tx, db, input, includedPlan.servicePlanId, reference.id, actorUid) : null;
    // Pick fields explicitly: callers cannot forge status, attribution, or parent display labels.
    tx.create(reference, {
      customerId: input.customerId, applianceId: input.applianceId, serviceType: input.serviceType,
      description: input.description.trim(), status: "pending", schemaVersion: 3,
      maintenanceCoverage: includedPlan ? "included" : "not_included",
      ...(booking ? { visitId: booking.visitId } : {}),
      ...(includedPlan ?? {}),
      assignedTechnicianUid: null, assignedTechnicianName: "", assignmentVersion: 0, assignmentUpdatedAt: null, assignedBy: null,
      customerName: customer.data().fullName, applianceLabel: appliance.data().brand + " " + appliance.data().model,
      createdAt: FieldValue.serverTimestamp(), createdBy: actorUid, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid,
    });
    recordServiceEvent(tx,db,reference.id,{...input,status:"pending"},"created",actorUid);
    booking?.apply();
    tx.create(key, { requestId: reference.id });
  });
  return reference.id;
}
export async function updateServiceRequestStatus(db, id, status, expectedStatus, actorUid, auth, completionNotes) {
  if (!validId(id) || !validId(actorUid) || !Object.hasOwn(transitions, status) || !Object.hasOwn(transitions, expectedStatus)) throw new ServiceRequestError("invalid");
  const reference = db.collection("serviceRequests").doc(id);
  await db.runTransaction(async tx => {
    const [actor, snapshot] = await Promise.all([tx.get(db.doc("users/" + actorUid)), tx.get(reference)]);
    if (actor.data()?.active !== true || actor.data()?.role !== "admin") throw new ServiceRequestError("forbidden");
    if (!snapshot.exists) throw new ServiceRequestError("not-found");
    const data = snapshot.data();
    if (data.status !== expectedStatus) throw new ServiceRequestError("conflict");
    if (!transitions[data.status]?.includes(status)) throw new ServiceRequestError("transition");
    if ((status === "in_progress" || status === "completed") && !data.assignedTechnicianUid) throw new ServiceRequestError("assignment-required");
    if (status === "in_progress") {
      const technician = await tx.get(db.doc("users/" + data.assignedTechnicianUid));
      if (technician.data()?.role !== "technician" || technician.data()?.active !== true) throw new ServiceRequestError("technician-unavailable");
      if (!auth) throw new Error("Technician identity verification unavailable.");
      let account;
      try { account = await auth.getUser(data.assignedTechnicianUid); }
      catch (error) { if (error?.code === "auth/user-not-found") throw new ServiceRequestError("technician-unavailable"); throw error; }
      if (account.disabled || !account.emailVerified) throw new ServiceRequestError("technician-unavailable");
    }
    const key = db.collection("serviceRequestKeys").doc(keyFor(data));
    const reservation = await tx.get(key);
    if (reservation.data()?.requestId !== id) throw new ServiceRequestError("conflict");
    let notes, work, workRef;
    if (status === "completed") {
      workRef = db.doc("serviceWork/" + id);
      work = await tx.get(workRef);
      notes = requireCompletionNotes(completionNotes === undefined ? work.data()?.notes : completionNotes);
    }
    const applyVisit = status === "cancelled"
      ? await prepareVisitState(tx, db, data, id, "scheduled", actorUid)
      : status === "in_progress" ? await prepareVisitState(tx, db, data, id, "confirmed", actorUid) : () => {};
    const applyPlan = status === "completed" ? await preparePlanCompletion(tx, db, data, id, actorUid) : () => (data.servicePlanId ? { servicePlanOutcome: "not_used", servicePlanCreditUsed: false } : {});
    applyVisit();
    if (status === "completed") tx.set(workRef, {
      notes, completedNotes: notes, completedBy: actorUid, completedAt: FieldValue.serverTimestamp(),
      version: (work.data()?.version ?? 0) + 1, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid,
    });
    tx.update(reference, { status, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid, ...applyPlan() });
    recordServiceEvent(tx,db,id,{...data,status},"status_"+status,actorUid);
    if (status === "completed" || status === "cancelled") tx.delete(key);
  });
}
