import { recordServiceEvent } from "./lifecycle-events.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { ServiceRequestError } from "./service-request-store.mjs";
const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export async function assignTechnician(db, auth, id, technicianUid, expectedVersion, operatorUid) {
  if (!validId(id) || !validId(operatorUid) || technicianUid !== null && !validId(technicianUid)
    || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new ServiceRequestError("invalid");
  // Auth identity is checked by the real Admin SDK; no client-provided profile is accepted.
  let account = null;
  if (technicianUid) {
    try { account = await auth.getUser(technicianUid); }
    catch (error) {
      if (error?.code === "auth/user-not-found") throw new ServiceRequestError("technician-unavailable");
      throw error;
    }
    if (account.disabled || !account.emailVerified) throw new ServiceRequestError("technician-unavailable");
  }
  await db.runTransaction(async tx => {
    const reference = db.doc("serviceRequests/" + id);
    const [actor, snapshot, technician] = await Promise.all([
      tx.get(db.doc("users/" + operatorUid)), tx.get(reference),
      technicianUid ? tx.get(db.doc("users/" + technicianUid)) : Promise.resolve(null),
    ]);
    if (actor.data()?.role !== "admin" || actor.data()?.active !== true) throw new ServiceRequestError("forbidden");
    if (!snapshot.exists) throw new ServiceRequestError("not-found");
    const data = snapshot.data();
    if (data.status !== "pending" && !(data.status === "in_progress" && !data.assignedTechnicianUid && technicianUid)) throw new ServiceRequestError("assignment-closed");
    const version = data.assignmentVersion ?? 0;
    if (version !== expectedVersion) throw new ServiceRequestError("conflict");
    if ((data.assignedTechnicianUid ?? null) === technicianUid) throw new ServiceRequestError("assignment-unchanged");
    if (technicianUid && (technician.data()?.role !== "technician" || technician.data()?.active !== true)) throw new ServiceRequestError("technician-unavailable");
    const name = technicianUid ? (typeof technician.data()?.displayName === "string" ? technician.data().displayName : account.displayName || "Technician") : "";
    recordServiceEvent(tx,db,id,data,"assignment_"+(version+1),operatorUid);
    tx.update(reference, {
      assignedTechnicianUid: technicianUid, assignedTechnicianName: name,
      assignmentVersion: version + 1, assignmentUpdatedAt: FieldValue.serverTimestamp(), assignedBy: operatorUid,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: operatorUid,
    });
  });
}
