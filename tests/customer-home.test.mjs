import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function load(file, dependencies) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, { module: testModule, exports: testModule.exports, require(name) { if (!(name in dependencies)) throw Error("Unexpected dependency: " + name); return dependencies[name]; } });
  return testModule.exports;
}
const base = {
  "next/image": { default: ({ alt, ...props }) => React.createElement("img", { alt, ...props }) },
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "./home.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
  "./icons": { HomeIcon: () => null },
  "@/components/brand": { Brand: () => React.createElement("span", null, "iTech") },
  "@/components/logout-button": { LogoutButton: () => React.createElement("button", null, "Sign out") },
  "@/lib/appliances/data": { applianceTypes: { ac: "Air conditioner", water_purifier: "Water purifier" } },
  "@/lib/service-plans/data": { indiaDate: () => "2026-11-17" },
  "@/lib/service-requests/data": { requestStatuses: { pending: "Pending", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" }, serviceTypes: { installation: "Installation", maintenance: "Maintenance", repair: "Repair / complaint" } },
};
let navigationPath = "/customer";
const navigationModule = load("src/components/ui/workspace-navigation.tsx", {
  "react": React,
  "react/jsx-runtime": JsxRuntime,
  "next/link": base["next/link"],
  "next/navigation": { usePathname: () => navigationPath },
  "@/components/logout-button": base["@/components/logout-button"],
  "@/components/admin-dashboard/icons": { Icon: () => null },
  "./workspace-navigation.module.css": base["./home.module.css"],
});
base["@/components/ui/workspace-navigation"] = navigationModule;
const { CustomerHome } = load("src/components/customer-home/dashboard.tsx", base);
const appliance = { id: "own-appliance", brand: "Very long appliance brand", model: "Customer model", type: "water_purifier", installationDate: "2026-11-17", active: true };
const current = { id: "own-plan", name: "Included care", status: "active", startsOn: "2026-11-17", expiresOn: "2027-11-17", usedServices: 1, totalServices: 2, remainingServices: 1 };
const profile = { uid: "owner", role: "customer", displayName: "Asha Customer" };
const props = () => ({ profile, overview: { customer: { active: true }, items: [{ appliance: { ...appliance }, current: { ...current }, upcoming: null }], nextCursor: null }, requests: [], openRequests: "0", schedule: [], moreSchedule: false, renewals: [] });
const render = value => renderToStaticMarkup(React.createElement(CustomerHome, value));

test("Home renders real supplied name/balances and routes eligible booking and complaint to own appliance", () => {
  const html = render(props());
  assert.match(html, /Hello, Asha/); assert.match(html, /1 remaining/); assert.match(html, /1 of 2 visits used/);
  assert.match(html, /applianceId=own-appliance&amp;serviceType=maintenance&amp;free=1/);
  assert.match(html, /applianceId=own-appliance&amp;serviceType=repair/); assert.match(html, /Installation, repairs and complaints are separate/);
});
test("Home expired/exhausted/upcoming periods do not offer included booking or manufacture remaining credits", () => {
  for (const status of ["expired", "exhausted", "upcoming"]) {
    const p = props(); p.overview.items[0].current = { ...current, status, remainingServices: 0 };
    const html = render(p); assert.doesNotMatch(html, /serviceType=maintenance/); assert.match(html, /serviceType=repair/);
    if (status === "upcoming") assert.match(html, /Visits become available when this period starts/);
  }
});
test("Home inactive customer or appliance does not offer per-appliance maintenance/complaint actions", () => {
  for (const field of ["customer", "appliance"]) {
    const p = props(); if (field === "customer") p.overview.customer.active = false; else p.overview.items[0].appliance.active = false;
    assert.doesNotMatch(render(p), /serviceType=(maintenance|repair)/);
  }
});
test("Home unlinked and empty account states have useful destinations and no fabricated appliance metrics", () => {
  const p = props(); p.overview = { customer: null, items: [], nextCursor: null };
  const unlinked = render(p); assert.match(unlinked, /Let’s connect your home/); assert.doesNotMatch(unlinked, /Open requests/);
  p.overview.customer = { active: true };
  const empty = render(p); assert.match(empty, /Your home starts here/); assert.match(empty, /Nothing coming up just yet/); assert.match(empty, /No requests to track yet/);
});
test("Home filters completed/past/expired schedules and separates requested/work-started from appointments", () => {
  const p = props(); const row = { dueOn: "2027-05-17", expiresOn: "2027-11-17", applianceLabel: "OWN SCHEDULE", status: "due", workflowStatus: "scheduled" };
  p.schedule = [{ ...row, id: "completed", status: "completed", applianceLabel: "COMPLETED HIDDEN" }, { ...row, id: "past", dueOn: "2020-01-01", applianceLabel: "PAST HIDDEN" }, { ...row, id: "expired", expiresOn: "2020-01-01", applianceLabel: "EXPIRED HIDDEN" }, { ...row, id: "requested", requestId: "own-request", workflowStatus: "requested" }, { ...row, id: "started", requestId: "started-request", workflowStatus: "confirmed" }];
  const html = render(p); assert.doesNotMatch(html, /COMPLETED HIDDEN|PAST HIDDEN|EXPIRED HIDDEN/);
  assert.match(html, /Requested/); assert.match(html, /Work started/); assert.match(html, /not booked appointments/);
  assert.match(html, /customer\/service-requests\/own-request/);
});
test("Home renewal message preserves owner agreement then Admin approval and only links to existing workflow", () => {
  const p = props(); p.renewals = [{ id: "proposal", status: "awaiting_customer" }];
  const html = render(p); assert.match(html, /Your agreement comes before Admin confirmation/); assert.match(html, /customer\/lifecycle\?view=renewals/); assert.doesNotMatch(html, /<form|Confirm renewal/);
  p.renewals[0].status = "agreed"; assert.match(render(p), /Admin confirmation is the next step/);
});
test("Home paginated displays label known lower bound and do not claim absence beyond loaded schedule", () => {
  const p = props(); p.overview.nextCursor = "more-appliances"; p.moreSchedule = true; p.openRequests = "50+";
  const html = render(p); assert.match(html, /Active plans shown/); assert.match(html, /50\+/); assert.match(html, /More care on your calendar/);
});
test("Home frame adds bottom navigation across all customer routes; other roles get original children", () => {
  let pathname = "/customer";
  const { CustomerHomeFrame } = load("src/components/customer-home/home-frame.tsx", { ...base, "next/navigation": { usePathname: () => pathname } });
  const output = () => { navigationPath = pathname; return renderToStaticMarkup(React.createElement(CustomerHomeFrame, null, React.createElement("p", null, "Existing shell"))); };
  assert.match(output(), /Customer home navigation/); assert.match(output(), /aria-current="page"/);
  for (const route of ["/customer/appliances", "/customer/service-requests", "/customer/profile"]) {
    pathname = route;
    const res = output();
    assert.match(res, /Customer home navigation/);
    assert.match(res, /aria-current="page"/);
  }
  for (const route of ["/admin", "/technician", "/admin/customers"]) {
    pathname = route;
    assert.equal(output(), "<p>Existing shell</p>");
  }
});
test("Home route requires Customer authentication and passes the same actor to all existing scoped readers", async () => {
  let calls = 0;
  const page = load("src/app/customer/page.tsx", {
    "react/jsx-runtime": JsxRuntime,
    "@/lib/auth": { requireRole: async role => { assert.equal(role, "customer"); return profile; } },
    "@/lib/service-plans/server": { ownPlanOverview: async actor => { assert.equal(actor, profile); calls++; return props().overview; } },
    "@/lib/service-requests/server": { listServiceRequests: async (actor, status) => { assert.equal(actor, profile); calls++; return { items: status ? [{ id: status }] : [], nextCursor: status === "pending" ? "more" : null }; } },
    "@/lib/lifecycle/server": { lifecyclePage: async actor => { assert.equal(actor, profile); calls++; return { items: [], nextCursor: null }; } },
    "@/components/customer-home/dashboard": { CustomerHome: () => null },
  });
  const element = await page.default(); assert.equal(calls, 6); assert.equal(element.props.openRequests, "2+");
});
test("Home loading and error states have accessible status, retry and existing profile destination", () => {
  const dependencies = { ...base, "@/components/customer-home/home.module.css": base["./home.module.css"], "@/components/customer-home/icons": base["./icons"] };
  const loading = load("src/app/customer/loading.tsx", dependencies).default;
  const error = load("src/app/customer/error.tsx", dependencies).default;
  const loadingHtml = renderToStaticMarkup(React.createElement(loading)); assert.match(loadingHtml, /aria-busy="true"/); assert.match(loadingHtml, /Getting your home ready/);
  const errorHtml = renderToStaticMarkup(React.createElement(error, { reset: () => {} })); assert.match(errorHtml, /role="alert"/); assert.match(errorHtml, /Try again/); assert.match(errorHtml, /href="\/customer\/profile"/);
});
