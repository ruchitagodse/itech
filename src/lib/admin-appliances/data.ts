import type { ApplianceRecord } from "@/lib/appliances/data";

export type CoverageStatus = "active" | "upcoming" | "expired" | "exhausted" | "none";

export type AppliancePlanSummary = {
  id?: string;
  name: string;
  status: CoverageStatus;
  startsOn?: string;
  expiresOn?: string;
  totalServices?: number;
  usedServices?: number;
  remainingServices?: number;
};

export type ApplianceInventoryItem = ApplianceRecord & {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCity?: string;
  plan: AppliancePlanSummary | null;
};

export type ApplianceMetrics = {
  total: number;
  ac: number;
  waterPurifier: number;
  activeCoverage: number;
  expiredCoverage: number;
};

export const applianceTypeFilters = ["all", "ac", "water_purifier"] as const;
export type ApplianceTypeFilter = (typeof applianceTypeFilters)[number];

export const coverageFilters = ["all", "active", "expired", "none"] as const;
export type CoverageFilter = (typeof coverageFilters)[number];

export function matchesAppliance(
  item: ApplianceInventoryItem,
  query: string,
  typeFilter: string,
  coverageFilter: string
): boolean {
  if (typeFilter && typeFilter !== "all" && item.type !== typeFilter) {
    return false;
  }

  if (coverageFilter && coverageFilter !== "all") {
    const planStatus = item.plan?.status ?? "none";
    if (coverageFilter === "active" && planStatus !== "active") return false;
    if (coverageFilter === "expired" && planStatus !== "expired" && planStatus !== "exhausted") return false;
    if (coverageFilter === "none" && planStatus !== "none") return false;
  }

  if (!query) return true;

  const q = query.trim().toLowerCase();
  const searchTargets = [
    item.brand,
    item.model,
    item.serialNumber,
    item.customerName,
    item.customerPhone,
    item.customerCity,
  ];

  return searchTargets.some(target => target && target.toLowerCase().includes(q));
}
