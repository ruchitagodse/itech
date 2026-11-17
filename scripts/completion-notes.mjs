import { ServiceRequestError } from "./service-errors.mjs";
export function requireCompletionNotes(value) {
  if (typeof value !== "string" || !value.trim()) throw new ServiceRequestError("notes-required");
  if (value.trim().length > 2000) throw new ServiceRequestError("invalid");
  return value.trim();
}
