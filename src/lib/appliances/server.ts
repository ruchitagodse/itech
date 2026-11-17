import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { Profile } from "@/lib/roles";
import { adminServices } from "@/lib/firebase/admin";
import { getCustomer, ownCustomer, CustomerAccessError } from "@/lib/customers/server";
import { saveAppliance, ApplianceStoreError } from "../../../scripts/appliance-store.mjs";
import type { ApplianceInput, ApplianceRecord } from "./data";
export { ApplianceStoreError };
function validId(id: string) { return /^[a-zA-Z0-9_-]{1,128}$/.test(id); }
function toRecord(snapshot: DocumentSnapshot, customerId: string): ApplianceRecord {
  const data = snapshot.data()!;
  return { id: snapshot.id, customerId, type: data.type, brand: data.brand, model: data.model,
    serialNumber: data.serialNumber, purchaseDate: data.purchaseDate, installationDate: data.installationDate,
    notes: data.notes, active: data.active, createdAt: data.createdAt?.toDate().toISOString() ?? "", updatedAt: data.updatedAt?.toDate().toISOString() ?? "" };
}
export async function listAppliances(profile: Profile, customerId: string, cursor = "") {
  const customer = await getCustomer(profile, customerId);
  if (!customer) throw new CustomerAccessError(404);
  if (cursor && !validId(cursor)) throw new CustomerAccessError(400);
  const collection = adminServices().db.collection("customers").doc(customerId).collection("appliances");
  let query = collection.orderBy("createdAt", "desc");
  if (cursor) { const marker = await collection.doc(cursor).get(); if (marker.exists) query = query.startAfter(marker); }
  const snapshot = await query.limit(26).get();
  const items = snapshot.docs.slice(0, 25).map(doc => toRecord(doc, customerId));
  return { items, nextCursor: snapshot.size > 25 ? items[items.length - 1].id : null };
}
export async function getAppliance(profile: Profile, customerId: string, id: string) {
  const customer = await getCustomer(profile, customerId);
  if (!customer || !validId(id)) throw new CustomerAccessError(404);
  const snapshot = await adminServices().db.collection("customers").doc(customerId).collection("appliances").doc(id).get();
  return snapshot.exists ? toRecord(snapshot, customerId) : null;
}
export async function persistAppliance(profile: Profile, customerId: string, input: ApplianceInput, id?: string) {
  if (profile.role !== "admin") throw new CustomerAccessError(403);
  if (!validId(customerId) || id && !validId(id)) throw new CustomerAccessError(404);
  return saveAppliance(adminServices().db, customerId, input, { operatorUid: profile.uid, id });
}
export async function customerAppliances(profile: Profile, cursor = "") {
  const customer = await ownCustomer(profile);
  return customer ? { customer, ...await listAppliances(profile, customer.id, cursor) } : { customer: null, items: [], nextCursor: null };
}
