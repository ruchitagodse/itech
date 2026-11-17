import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { Profile } from "@/lib/roles";
import { adminServices } from "@/lib/firebase/admin";
import { getCustomer, ownCustomer } from "@/lib/customers/server";
import { getAppliance } from "@/lib/appliances/server";
import { createServiceRequest, updateServiceRequestStatus, ServiceRequestError } from "../../../scripts/service-request-store.mjs";
import { validId, isStatus, type ServiceRequestRecord, type ServiceRequestInput, type RequestStatus } from "./data";
export { ServiceRequestError };
function allowed(profile: Profile) { if (profile.role !== "admin" && profile.role !== "customer") throw new ServiceRequestError("forbidden"); }
export function serviceRequestRecord(doc: DocumentSnapshot): ServiceRequestRecord {
  const data = doc.data()!;
  return { id: doc.id, customerId: data.customerId, applianceId: data.applianceId, serviceType: data.serviceType, description: data.description,
    status: data.status, customerName: data.customerName, applianceLabel: data.applianceLabel,
    visitId: data.visitId ?? null, schemaVersion: data.schemaVersion ?? null,
    servicePlanId: data.servicePlanId ?? null, servicePlanName: data.servicePlanName ?? "", servicePlanOutcome: data.servicePlanOutcome ?? "none", servicePlanCreditUsed: data.servicePlanCreditUsed === true,
    assignedTechnicianUid: data.assignedTechnicianUid ?? null, assignedTechnicianName: data.assignedTechnicianName ?? "", assignmentVersion: data.assignmentVersion ?? 0, assignmentUpdatedAt: data.assignmentUpdatedAt?.toDate().toISOString() ?? "",
    createdAt: data.createdAt?.toDate().toISOString() ?? "", updatedAt: data.updatedAt?.toDate().toISOString() ?? "" };
}
export async function listServiceRequests(profile: Profile, status = "", cursor = "") {
  allowed(profile);
  if (status && !isStatus(status) || cursor && !validId(cursor)) throw new ServiceRequestError("invalid");
  // Customer IDs are resolved from the current session, never from a query parameter.
  const customer = profile.role === "customer" ? await ownCustomer(profile) : null;
  if (profile.role === "customer" && !customer) return { items: [], nextCursor: null };
  const collection = adminServices().db.collection("serviceRequests");
  let query = collection.orderBy("createdAt", "desc");
  if (customer) query = query.where("customerId", "==", customer.id);
  if (status) query = query.where("status", "==", status);
  if (cursor) {
    const marker = await collection.doc(cursor).get();
    if (!marker.exists || customer && marker.data()?.customerId !== customer.id || status && marker.data()?.status !== status) throw new ServiceRequestError("invalid");
    query = query.startAfter(marker);
  }
  const snapshot = await query.limit(26).get();
  const items = snapshot.docs.slice(0, 25).map(serviceRequestRecord);
  return { items, nextCursor: snapshot.size > 25 ? items[items.length - 1].id : null };
}
export async function getServiceRequest(profile: Profile, id: string) {
  allowed(profile);
  if (!validId(id)) throw new ServiceRequestError("not-found");
  const snapshot = await adminServices().db.collection("serviceRequests").doc(id).get();
  if (!snapshot.exists) return null;
  if (profile.role === "customer") {
    const customer = await getCustomer(profile, snapshot.data()!.customerId);
    if (!customer) throw new ServiceRequestError("forbidden");
  }
  return serviceRequestRecord(snapshot);
}
export async function requestContext(profile: Profile, customerId: string, applianceId: string) {
  allowed(profile);
  if (!validId(customerId) || !validId(applianceId)) throw new ServiceRequestError("not-found");
  const customer = await getCustomer(profile, customerId);
  const appliance = await getAppliance(profile, customerId, applianceId);
  if (!customer || !appliance) throw new ServiceRequestError("not-found");
  return { customer, appliance };
}
export async function submitServiceRequest(profile: Profile, input: ServiceRequestInput) {
  allowed(profile);
  return createServiceRequest(adminServices().db, input, profile.uid);
}
export async function changeRequestStatus(profile: Profile, id: string, status: RequestStatus, expectedStatus: RequestStatus, notes?: string) {
  if (profile.role !== "admin") throw new ServiceRequestError("forbidden");
  const { db, auth } = adminServices();
  return updateServiceRequestStatus(db, id, status, expectedStatus, profile.uid, auth, notes);
}
