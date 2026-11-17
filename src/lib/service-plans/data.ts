import { validPlanDate, indiaDate, planBalance } from "../../../scripts/service-plan-dates.mjs";
import { validId } from "@/lib/service-requests/data";
export { indiaDate, planBalance };
export type PlanInput = { name: string; startsOn: string; expiresOn: string; packageId: string | null; expectedLatestPlanId: string | null };
export type PlanRecord = { id: string; name: string; startsOn: string; expiresOn: string; packageId: string | null; renewedFrom: string | null; totalServices: number; usedServices: number; createdAt: string; status: "active" | "upcoming" | "expired" | "exhausted"; remainingServices: number; expiredServices: number };
export function validatePlan(value: unknown): PlanInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 100
    || typeof raw.startsOn !== "string" || typeof raw.expiresOn !== "string" || !validPlanDate(raw.startsOn) || !validPlanDate(raw.expiresOn) || raw.expiresOn < raw.startsOn
    || raw.packageId !== null && !validId(raw.packageId) || raw.expectedLatestPlanId !== null && !validId(raw.expectedLatestPlanId)) return null;
  return { name: raw.name.trim(), startsOn: raw.startsOn, expiresOn: raw.expiresOn, packageId: raw.packageId as string | null, expectedLatestPlanId: raw.expectedLatestPlanId as string | null };
}
export function nextDay(value: string) { const date = new Date(value + "T00:00:00Z"); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
export function nextYear(value: string) {
  const date = new Date(value + "T00:00:00Z"), month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}
