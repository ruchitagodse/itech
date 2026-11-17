import { recordServiceEvent } from "./lifecycle-events.mjs";
import { preparePlanCompletion } from "./service-plan-core.mjs";
import { requireCompletionNotes } from "./completion-notes.mjs";
import { prepareVisitState } from "./maintenance-visits.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { ServiceRequestError, keyFor } from "./service-request-store.mjs";
const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export async function updateTechnicianWork(db, id, input, actorUid) {
  if (!validId(id) || !validId(actorUid) || !["start","save_notes","complete"].includes(input?.action)
    || typeof input.notes !== "string" || input.notes.trim().length > 2000
    || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0
    || !["pending","in_progress"].includes(input.expectedStatus)) throw new ServiceRequestError("invalid");
  if (input.action === "complete") requireCompletionNotes(input.notes);
  await db.runTransaction(async tx => {
    const requestRef = db.doc("serviceRequests/" + id), workRef = db.doc("serviceWork/" + id);
    const [actor, request, work] = await Promise.all([tx.get(db.doc("users/" + actorUid)), tx.get(requestRef), tx.get(workRef)]);
    if (actor.data()?.role !== "technician" || actor.data()?.active !== true) throw new ServiceRequestError("forbidden");
    if (!request.exists || request.data().assignedTechnicianUid !== actorUid) throw new ServiceRequestError("forbidden");
    const data = request.data();
    if (data.status !== input.expectedStatus || (work.data()?.version ?? 0) !== input.expectedVersion) throw new ServiceRequestError("conflict");
    if (input.action === "start" ? data.status !== "pending" : data.status !== "in_progress") throw new ServiceRequestError("transition");
    let reservationRef;
    if (input.action === "complete") {
      reservationRef = db.collection("serviceRequestKeys").doc(keyFor(data));
      const reservation = await tx.get(reservationRef);
      if (reservation.data()?.requestId !== id) throw new ServiceRequestError("conflict");
    }
    const applyVisit = input.action === "start" ? await prepareVisitState(tx, db, data, id, "confirmed", actorUid) : () => {};
    const applyPlan = input.action === "complete" ? await preparePlanCompletion(tx, db, data, id, actorUid) : () => ({});
    applyVisit();
    tx.set(workRef, { ...(input.action === "complete" ? { completedNotes: requireCompletionNotes(input.notes), completedBy: actorUid, completedAt: FieldValue.serverTimestamp() } : {}), notes: input.notes.trim(), version: (work.data()?.version ?? 0) + 1, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid });
    const status = input.action === "start" ? "in_progress" : input.action === "complete" ? "completed" : "in_progress";
    tx.update(requestRef, { status, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid, ...applyPlan() });
    if (input.action !== "save_notes") recordServiceEvent(tx,db,id,{...data,status},"status_"+status,actorUid);
    if (reservationRef) tx.delete(reservationRef);
  });
}
