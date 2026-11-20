import "server-only";
import type { Profile } from "@/lib/roles";
import { adminServices } from "@/lib/firebase/admin";
import { CustomerAccessError, getCustomer } from "@/lib/customers/server";
import { getAppliance } from "@/lib/appliances/server";
import { listAppliancePlans } from "@/lib/service-plans/server";
import { serviceRequestRecord } from "@/lib/service-requests/server";
import { indiaDate, planBalance } from "@/lib/service-plans/data";
import type { ApplianceRecord } from "@/lib/appliances/data";
import {
  matchesAppliance,
  type ApplianceInventoryItem,
  type ApplianceMetrics,
  type CoverageStatus,
  type AppliancePlanSummary,
} from "./data";

function assertAdmin(profile: Profile) {
  if (profile.role !== "admin") {
    throw new CustomerAccessError(403);
  }
}

async function safeRead<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export type AdminApplianceInventoryData = {
  items: ApplianceInventoryItem[];
  matched: number;
  nextCursor: string | null;
  cursor: string;
  query: string;
  typeFilter: string;
  coverageFilter: string;
  metrics: ApplianceMetrics;
};

export async function adminApplianceInventory(
  profile: Profile,
  searchParams: { q?: string; type?: string; coverage?: string; cursor?: string } = {}
): Promise<AdminApplianceInventoryData> {
  assertAdmin(profile);
  const db = adminServices().db;

  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const typeFilter = typeof searchParams.type === "string" ? searchParams.type : "all";
  const coverageFilter = typeof searchParams.coverage === "string" ? searchParams.coverage : "all";
  const cursor = typeof searchParams.cursor === "string" ? searchParams.cursor : "";

  const [customersSnap, appliancesSnap, plansSnap] = await Promise.all([
    safeRead(() => db.collection("customers").get()),
    safeRead(() => db.collectionGroup("appliances").get()),
    safeRead(() => db.collectionGroup("servicePlans").get()),
  ]);

  const customerMap = new Map<string, { fullName: string; phone?: string; email?: string; city?: string }>();
  for (const doc of customersSnap?.docs ?? []) {
    const data = doc.data();
    customerMap.set(doc.id, {
      fullName: data.fullName || "Unnamed Customer",
      phone: data.phone,
      email: data.email,
      city: data.city,
    });
  }

  const today = indiaDate();
  // Map of applianceId -> latest plan summary
  const planMap = new Map<string, AppliancePlanSummary>();

  for (const doc of plansSnap?.docs ?? []) {
    // customers/{customerId}/appliances/{applianceId}/servicePlans/{planId}
    if (!/^customers\/[^/]+\/appliances\/[^/]+\/servicePlans\/[^/]+$/.test(doc.ref.path)) continue;
    const parts = doc.ref.path.split("/");
    const applianceId = parts[3];
    const data = doc.data();

    const balance = planBalance(
      {
        startsOn: data.startsOn,
        expiresOn: data.expiresOn,
        totalServices: data.totalServices,
        usedServices: data.usedServices,
      },
      today
    );

    const summary: AppliancePlanSummary = {
      id: doc.id,
      name: data.name || "Service Plan",
      status: balance.status as CoverageStatus,
      startsOn: data.startsOn,
      expiresOn: data.expiresOn,
      totalServices: data.totalServices,
      usedServices: data.usedServices,
      remainingServices: balance.remainingServices,
    };

    const existing = planMap.get(applianceId);
    if (!existing || summary.status === "active" || (existing.status !== "active" && (summary.expiresOn ?? "") > (existing.expiresOn ?? ""))) {
      planMap.set(applianceId, summary);
    }
  }

  const allItems: ApplianceInventoryItem[] = [];
  let totalAc = 0;
  let totalWp = 0;
  let totalActiveCoverage = 0;
  let totalExpiredCoverage = 0;

  for (const doc of appliancesSnap?.docs ?? []) {
    if (!/^customers\/[^/]+\/appliances\/[^/]+$/.test(doc.ref.path)) continue;
    const customerId = doc.ref.parent.parent!.id;
    const data = doc.data();

    const record: ApplianceRecord = {
      id: doc.id,
      customerId,
      type: data.type === "ac" ? "ac" : "water_purifier",
      brand: data.brand || "",
      model: data.model || "",
      serialNumber: data.serialNumber || "",
      purchaseDate: data.purchaseDate || "",
      installationDate: data.installationDate || "",
      notes: data.notes || "",
      active: data.active === true,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? "",
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? "",
    };

    const customer = customerMap.get(customerId) ?? { fullName: "Unlinked Customer" };
    const plan = planMap.get(doc.id) ?? null;

    if (record.type === "ac") totalAc++;
    else totalWp++;

    if (plan?.status === "active") totalActiveCoverage++;
    else if (plan?.status === "expired" || plan?.status === "exhausted") totalExpiredCoverage++;

    const item: ApplianceInventoryItem = {
      ...record,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerCity: customer.city,
      plan,
    };

    if (matchesAppliance(item, query, typeFilter, coverageFilter)) {
      allItems.push(item);
    }
  }

  // Sort descending by creation date or installation date
  allItems.sort((a, b) => (b.createdAt || b.installationDate || "").localeCompare(a.createdAt || a.installationDate || ""));

  const matched = allItems.length;

  // Pagination (25 per page)
  const pageSize = 25;
  let startIndex = 0;
  if (cursor) {
    const idx = allItems.findIndex(i => i.id === cursor);
    if (idx !== -1) {
      startIndex = idx + 1;
    }
  }

  const paginated = allItems.slice(startIndex, startIndex + pageSize);
  const nextCursor = startIndex + pageSize < allItems.length ? paginated[paginated.length - 1]?.id ?? null : null;

  return {
    items: paginated,
    matched,
    nextCursor,
    cursor,
    query,
    typeFilter,
    coverageFilter,
    metrics: {
      total: appliancesSnap?.docs?.length ?? 0,
      ac: totalAc,
      waterPurifier: totalWp,
      activeCoverage: totalActiveCoverage,
      expiredCoverage: totalExpiredCoverage,
    },
  };
}

export async function adminApplianceDetail(
  profile: Profile,
  customerId: string,
  applianceId: string
) {
  assertAdmin(profile);
  const db = adminServices().db;

  const [customer, appliance, plans, requestsSnap] = await Promise.all([
    getCustomer(profile, customerId),
    getAppliance(profile, customerId, applianceId),
    safeRead(() => listAppliancePlans(profile, customerId, applianceId)),
    safeRead(() =>
      db
        .collection("serviceRequests")
        .where("applianceId", "==", applianceId)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get()
    ),
  ]);

  if (!customer || !appliance) {
    return null;
  }

  const requests = requestsSnap?.docs?.map(serviceRequestRecord) ?? [];

  return {
    customer,
    appliance,
    plans,
    requests,
  };
}

export async function listCustomersForSelection(profile: Profile) {
  assertAdmin(profile);
  const db = adminServices().db;
  const snap = await db.collection("customers").where("active", "==", true).orderBy("fullName", "asc").limit(100).get();
  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      fullName: d.fullName || "Unnamed Customer",
      phone: d.phone || "",
      city: d.city || "",
    };
  });
}
