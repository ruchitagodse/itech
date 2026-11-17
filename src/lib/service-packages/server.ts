import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { Profile } from "@/lib/roles";
import { adminServices } from "@/lib/firebase/admin";
import { validId } from "@/lib/service-requests/data";
import { PackageStoreError, saveServicePackage } from "../../../scripts/service-package-store.mjs";
import type { ServicePackageInput, ServicePackageRecord } from "./data";
export { PackageStoreError };
function allowed(profile: Profile) { if (profile.role !== "admin" && profile.role !== "customer") throw new PackageStoreError("forbidden"); }
function record(doc: DocumentSnapshot): ServicePackageRecord {
  const data = doc.data()!;
  return { id: doc.id, name: data.name, applianceType: data.applianceType, serviceType: data.serviceType, pricePaise: data.pricePaise,
    description: data.description, policy: data.policy ?? null, active: data.active, version: data.version,
    createdAt: data.createdAt?.toDate().toISOString() ?? "", updatedAt: data.updatedAt?.toDate().toISOString() ?? "" };
}
export async function listServicePackages(profile: Profile, cursor = "") {
  allowed(profile);
  if (cursor && !validId(cursor)) throw new PackageStoreError("invalid");
  const collection = adminServices().db.collection("servicePackages");
  let query = collection.orderBy("createdAt", "desc");
  if (profile.role === "customer") query = query.where("active", "==", true);
  if (cursor) {
    const marker = await collection.doc(cursor).get();
    if (!marker.exists || profile.role === "customer" && marker.data()?.active !== true) throw new PackageStoreError("invalid");
    query = query.startAfter(marker);
  }
  const snapshot = await query.limit(26).get(), items = snapshot.docs.slice(0, 25).map(record);
  return { items, nextCursor: snapshot.size > 25 ? items[items.length - 1].id : null };
}
export async function getServicePackage(profile: Profile, id: string) {
  allowed(profile);
  if (!validId(id)) throw new PackageStoreError("not-found");
  const snapshot = await adminServices().db.collection("servicePackages").doc(id).get();
  if (!snapshot.exists || profile.role === "customer" && snapshot.data()?.active !== true) return null;
  return record(snapshot);
}
export async function persistServicePackage(profile: Profile, input: ServicePackageInput, id?: string, expectedVersion?: number) {
  if (profile.role !== "admin") throw new PackageStoreError("forbidden");
  return saveServicePackage(adminServices().db, input, { operatorUid: profile.uid, id, expectedVersion });
}
