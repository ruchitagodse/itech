import "server-only";
import { FieldPath } from "firebase-admin/firestore";
import type { Profile } from "@/lib/roles";
import { adminServices } from "@/lib/firebase/admin";
import { serviceRequestRecord, ServiceRequestError } from "@/lib/service-requests/server";
import { validId, isStatus } from "@/lib/service-requests/data";
import { assignTechnician } from "../../../scripts/assignment-store.mjs";
import type { AssignmentInput, TechnicianOption } from "./data";
export async function listTechnicians(profile: Profile, cursor = "") {
  if (profile.role !== "admin") throw new ServiceRequestError("forbidden");
  if (cursor && !validId(cursor)) throw new ServiceRequestError("invalid");
  const { db, auth } = adminServices();
  let query = db.collection("users").where("role", "==", "technician").orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.limit(26).get();
  const page = snapshot.docs.slice(0, 25);
  const active = page.filter(doc => doc.data().active === true);
  const result = active.length ? await auth.getUsers(active.map(doc => ({ uid: doc.id }))) : { users: [] };
  const accounts = new Map(result.users.map(user => [user.uid, user]));
  const items: TechnicianOption[] = [];
  for (const doc of active) {
    const account = accounts.get(doc.id);
    if (!account || account.disabled || !account.emailVerified) continue;
    items.push({ uid: doc.id, displayName: typeof doc.data().displayName === "string" ? doc.data().displayName : account.displayName || "Technician", email: account.email ?? "" });
  }
  return { items, nextCursor: snapshot.size > 25 ? page[page.length - 1].id : null };
}
export async function persistAssignment(profile: Profile, id: string, input: AssignmentInput) {
  if (profile.role !== "admin") throw new ServiceRequestError("forbidden");
  const { db, auth } = adminServices();
  return assignTechnician(db, auth, id, input.technicianUid, input.expectedVersion, profile.uid);
}
export async function listAssignments(profile: Profile, status = "", cursor = "") {
  if (profile.role !== "technician") throw new ServiceRequestError("forbidden");
  if (status && !isStatus(status) || cursor && !validId(cursor)) throw new ServiceRequestError("invalid");
  const collection = adminServices().db.collection("serviceRequests");
  let query = collection.where("assignedTechnicianUid", "==", profile.uid).orderBy("createdAt", "desc");
  if (status) query = query.where("status", "==", status);
  if (cursor) {
    const marker = await collection.doc(cursor).get();
    if (!marker.exists || marker.data()?.assignedTechnicianUid !== profile.uid || status && marker.data()?.status !== status) throw new ServiceRequestError("invalid");
    query = query.startAfter(marker);
  }
  const snapshot = await query.limit(26).get();
  const items = snapshot.docs.slice(0, 25).map(serviceRequestRecord);
  return { items, nextCursor: snapshot.size > 25 ? items[items.length - 1].id : null };
}
export async function getAssignment(profile: Profile, id: string) {
  if (profile.role !== "technician") throw new ServiceRequestError("forbidden");
  if (!validId(id)) throw new ServiceRequestError("not-found");
  const snapshot = await adminServices().db.collection("serviceRequests").doc(id).get();
  if (!snapshot.exists || snapshot.data()?.assignedTechnicianUid !== profile.uid) return null;
  return serviceRequestRecord(snapshot);
}
