// Local preview data only. Never imported by the application.
export async function lifecyclePage(...args) { const view = args[1]; return { items: view === "renewals" ? window.__uiFixtures.renewals : window.__uiFixtures.lifecycle, nextCursor: "next" }; }
export async function lifecycleKpis() { return { pending: 3, inProgress: 2, pendingRenewals: 1, overdueVisits: 2, upcomingVisits: 4, expiringPlans: 3, expiryWindowDays: 30 }; }
export async function lifecycleSettings() { return null; }
export async function ownConsent() { return { phone: "", enabled: false }; }
export async function listServicePackages() { return { items: [window.__uiFixtures.package], nextCursor: null }; }
export async function listAppliancePlans() { const f = window.__uiFixtures; return { appliance: f.appliance, items: [f.plan], current: f.plan, upcoming: null, latest: f.plan, nextCursor: null }; }
