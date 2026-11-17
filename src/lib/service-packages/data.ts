import { applianceTypes, type ApplianceType } from "@/lib/appliances/data";
import { serviceTypes, type ServiceType } from "@/lib/service-requests/data";
export type ServicePackageInput = { name: string; applianceType: ApplianceType; serviceType: ServiceType; pricePaise: number; description: string; active: boolean; policy?: { validityMonths: number; maintenanceIntervalMonths: number } | null };
export type ServicePackageRecord = ServicePackageInput & { id: string; version: number; createdAt: string; updatedAt: string };
export type PackageDraft = Omit<ServicePackageInput, "pricePaise"> & { price: string };
export type PackageErrors = Partial<Record<keyof PackageDraft, string>>;
export function validatePackage(value: unknown): { data: ServicePackageInput | null; errors: PackageErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { data: null, errors: { name: "Enter package details." } };
  const raw = value as Record<string, unknown>, errors: PackageErrors = {};
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const price = typeof raw.price === "string" ? raw.price.trim() : "";
  const parts = price.split(".");
  const pricePaise = /^(0|[1-9][0-9]{0,6})(\.[0-9]{1,2})?$/.test(price) ? Number(parts[0]) * 100 + Number((parts[1] ?? "").padEnd(2, "0")) : 0;
  if (!name || name.length > 100) errors.name = "Enter a package name of up to 100 characters.";
  if (typeof raw.applianceType !== "string" || !Object.hasOwn(applianceTypes, raw.applianceType)) errors.applianceType = "Choose an appliance type.";
  if (typeof raw.serviceType !== "string" || !Object.hasOwn(serviceTypes, raw.serviceType)) errors.serviceType = "Choose a service type.";
  if (!Number.isSafeInteger(pricePaise) || pricePaise <= 0 || pricePaise > 100000000) errors.price = "Enter an INR price above zero and up to 10,00,000, with at most two decimal places.";
  if (!description || description.length > 1000) errors.description = "Enter a description of up to 1,000 characters.";
  if (typeof raw.active !== "boolean") errors.active = "Choose Active or Inactive.";
  if (raw.policy !== undefined && raw.policy !== null) {
    const p = raw.policy as Record<string, unknown>;
    if (!Number.isInteger(p.validityMonths) || Number(p.validityMonths) < 1 || Number(p.validityMonths) > 120 || !Number.isInteger(p.maintenanceIntervalMonths) || Number(p.maintenanceIntervalMonths) < 1 || Number(p.maintenanceIntervalMonths) > 60) errors.policy = "Set validity (1–120 months) and maintenance interval (1–60 months).";
  }
  if (!errors.policy && raw.active === true && raw.serviceType === "maintenance" && raw.policy && typeof raw.policy === "object") {
    const policy = raw.policy as Record<string, number>;
    if (policy.validityMonths < 2 * policy.maintenanceIntervalMonths) errors.policy = "Plan validity must cover both visits: at least twice the maintenance interval.";
  }
  return { data: Object.keys(errors).length ? null : { name, applianceType: raw.applianceType as ApplianceType, serviceType: raw.serviceType as ServiceType, pricePaise, description, active: raw.active === true, ...(raw.policy !== undefined ? { policy: raw.policy as ServicePackageInput["policy"] } : {}) }, errors };
}
export function packagePrice(pricePaise: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(pricePaise / 100); }
