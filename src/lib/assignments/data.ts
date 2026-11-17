import { validId, type RequestStatus } from "@/lib/service-requests/data";
export type TechnicianOption = { uid: string; displayName: string; email: string };
export type TechnicianDirectory = { items: TechnicianOption[]; nextCursor: string | null };
export type AssignmentInput = { technicianUid: string | null; expectedVersion: number };
export function validateAssignment(value: unknown): AssignmentInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.technicianUid !== null && !validId(raw.technicianUid)) return null;
  if (typeof raw.expectedVersion !== "number" || !Number.isSafeInteger(raw.expectedVersion) || raw.expectedVersion < 0) return null;
  return { technicianUid: raw.technicianUid as string | null, expectedVersion: raw.expectedVersion };
}

export function canAssignTechnician(status: RequestStatus, uid: string | null) { return status === "pending" || status === "in_progress" && !uid; }
