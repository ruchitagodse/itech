import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminServices } from "@/lib/firebase/admin";
import type { Profile } from "@/lib/roles";
import { customerSearchTerm, type CustomerInput, type CustomerRecord } from "./data";
import { CustomerStoreError, saveCustomer } from "../../../scripts/customer-store.mjs";
export { CustomerStoreError };
export class CustomerAccessError extends Error {
  constructor(public status: number) { super("Customer access denied."); }
}
function admin(profile: Profile) { if (profile.role !== "admin") throw new CustomerAccessError(403); }
function record(snapshot: DocumentSnapshot): CustomerRecord {
  const data = snapshot.data()!;
  return {
    id: snapshot.id, fullName: data.fullName, email: data.email, phone: data.phone,
    alternatePhone: data.alternatePhone, address: data.address, city: data.city, state: data.state,
    pincode: data.pincode, active: data.active, ownerUid: data.ownerUid,
    createdAt: data.createdAt?.toDate().toISOString() ?? "", updatedAt: data.updatedAt?.toDate().toISOString() ?? "",
  };
}
export async function listCustomers(profile: Profile, query = "", cursor = "") {
  admin(profile);
  const { db } = adminServices();
  if (query.length > 254 || (cursor && !/^[a-zA-Z0-9_-]{1,128}$/.test(cursor))) throw new CustomerAccessError(400);
  const term = customerSearchTerm(query);
  let request = db.collection("customers").orderBy("createdAt", "desc");
  if (term) request = request.where("searchTokens", "array-contains", term);
  if (cursor) {
    const marker = await db.collection("customers").doc(cursor).get();
    if (marker.exists) request = request.startAfter(marker);
  }
  const snapshot = await request.limit(26).get();
  const items = snapshot.docs.slice(0, 25).map(record);
  return { items, nextCursor: snapshot.size > 25 ? items[items.length - 1].id : null };
}
export async function getCustomer(profile: Profile, id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new CustomerAccessError(404);
  if (profile.role !== "admin" && profile.role !== "customer") throw new CustomerAccessError(403);
  const snapshot = await adminServices().db.collection("customers").doc(id).get();
  if (!snapshot.exists) return null;
  if (profile.role === "customer" && snapshot.data()?.ownerUid !== profile.uid) throw new CustomerAccessError(403);
  return record(snapshot);
}
export async function ownCustomer(profile: Profile) {
  if (profile.role !== "customer") throw new CustomerAccessError(403);
  const snapshot = await adminServices().db.collection("customers").where("ownerUid", "==", profile.uid).limit(1).get();
  return snapshot.empty ? null : record(snapshot.docs[0]);
}
export async function persistCustomer(profile: Profile, input: CustomerInput, id?: string) {
  admin(profile);
  const { auth, db } = adminServices();
  let resolvedOwnerUid: string | null = null;
  // Once linked, contact changes do not transfer ownership or change the Auth account.
  const existing = id ? await db.collection("customers").doc(id).get() : null;
  if (id && !existing?.exists) throw new CustomerAccessError(404);
  if (!existing?.data()?.ownerUid) {
    try {
      const user = await auth.getUserByEmail(input.email);
      const userProfile = await db.doc("users/" + user.uid).get();
      if (userProfile.data()?.role !== "customer") throw new CustomerAccessError(409);
      resolvedOwnerUid = user.uid;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found")) throw error;
    }
  }
  return saveCustomer(db, input, { operatorUid: profile.uid, resolvedOwnerUid, id });
}
