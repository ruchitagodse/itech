export type WorkAction = "start" | "save_notes" | "complete";
export type WorkInput = { action: WorkAction; notes: string; expectedVersion: number; expectedStatus: "pending" | "in_progress" };
export type WorkRecord = { notes: string; version: number; updatedAt: string };
export function validateWork(value: unknown): WorkInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.action !== "start" && raw.action !== "save_notes" && raw.action !== "complete") return null;
  if (typeof raw.notes !== "string" || raw.notes.trim().length > 2000) return null;
  if (raw.action === "complete" && !raw.notes.trim()) return null;
  if (typeof raw.expectedVersion !== "number" || !Number.isSafeInteger(raw.expectedVersion) || raw.expectedVersion < 0) return null;
  if (raw.expectedStatus !== "pending" && raw.expectedStatus !== "in_progress") return null;
  return { action: raw.action, notes: raw.notes.trim(), expectedVersion: raw.expectedVersion, expectedStatus: raw.expectedStatus };
}
