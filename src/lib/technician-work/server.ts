import "server-only";
import type { Profile } from "@/lib/roles";
import { adminServices } from "@/lib/firebase/admin";
import { getAssignment } from "@/lib/assignments/server";
import { getServiceRequest, ServiceRequestError } from "@/lib/service-requests/server";
import { updateTechnicianWork } from "../../../scripts/technician-work-store.mjs";
import type { WorkInput, WorkRecord } from "./data";
export async function getWork(profile: Profile, id: string): Promise<WorkRecord> {
  if (profile.role !== "admin" && profile.role !== "technician") throw new ServiceRequestError("forbidden");
  const request = profile.role === "admin" ? await getServiceRequest(profile, id) : await getAssignment(profile, id);
  if (!request) throw new ServiceRequestError("forbidden");
  const snapshot = await adminServices().db.doc("serviceWork/" + id).get();
  const data = snapshot.data();
  return { notes: data?.notes ?? "", version: data?.version ?? 0, updatedAt: data?.updatedAt?.toDate().toISOString() ?? "" };
}
export async function persistWork(profile: Profile, id: string, input: WorkInput) {
  if (profile.role !== "technician") throw new ServiceRequestError("forbidden");
  return updateTechnicianWork(adminServices().db, id, input, profile.uid);
}
