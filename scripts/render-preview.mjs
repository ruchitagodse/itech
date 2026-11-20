import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as sass from "sass";
import ts from "typescript";

function load(file, dependencies) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, { module: testModule, exports: testModule.exports, require(name) { if (!(name in dependencies)) throw Error("Unexpected dependency: " + name); return dependencies[name]; } });
  return testModule.exports;
}

const icons = load("src/components/customer-home/icons.tsx", { "react/jsx-runtime": JsxRuntime });

// Base64 encode logo
const logoBase64 = "data:image/jpeg;base64," + readFileSync("public/itech-logo.jpeg").toString("base64");

const base = {
  "next/image": { default: ({ alt, className }) => React.createElement("img", { alt, src: logoBase64, className, style: { height: "32px", width: "auto", objectFit: "contain" } }) },
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, href, className, ...props }) => React.createElement("a", { href, className, ...props }, children) },
  "./home.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
  "./icons": icons,
  "@/components/brand": { Brand: () => React.createElement("div", { className: "brand" }, React.createElement("span", { className: "brand-symbol" }, "i"), "iTech") },
  "@/components/logout-button": { LogoutButton: () => React.createElement("button", { className: "logout-button" }, "Sign out") },
  "@/lib/appliances/data": { applianceTypes: { ac: "Air conditioner", water_purifier: "Water purifier" } },
  "@/lib/service-plans/data": { indiaDate: () => "2026-11-18" },
  "@/lib/service-requests/data": {
    requestStatuses: { pending: "Pending", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" },
    serviceTypes: { installation: "Installation", maintenance: "Maintenance", repair: "Repair / complaint" }
  },
};

const { CustomerHome } = load("src/components/customer-home/dashboard.tsx", base);
const { CustomerHomeFrame } = load("src/components/customer-home/home-frame.tsx", {
  ...base,
  "next/navigation": { usePathname: () => "/customer" }
});

const profile = { uid: "cust-1", role: "customer", displayName: "Asha Sharma" };
const overview = {
  customer: { active: true },
  items: [
    {
      appliance: { id: "app-1", brand: "Kent", model: "Grand Plus RO 9L", type: "water_purifier", installationDate: "2024-03-15", active: true },
      current: { id: "plan-1", name: "Comprehensive RO Care", status: "active", startsOn: "2024-03-15", expiresOn: "2025-03-14", totalServices: 3, usedServices: 2, remainingServices: 1 },
      upcoming: null,
    },
    {
      appliance: { id: "app-2", brand: "Daikin", model: "FTKM50 1.5 Ton 5-Star", type: "ac", installationDate: "2023-05-10", active: true },
      current: { id: "plan-2", name: "Annual AC Maintenance Plan", status: "active", startsOn: "2024-05-10", expiresOn: "2025-05-09", totalServices: 2, usedServices: 1, remainingServices: 1 },
      upcoming: null,
    }
  ],
  nextCursor: null
};

const requests = [
  {
    id: "req-101",
    customerId: "cust-1",
    customerName: "Asha Sharma",
    applianceId: "app-1",
    applianceLabel: "Kent Grand Plus RO 9L",
    serviceType: "maintenance",
    status: "in_progress",
    assignedTechnicianName: "Vikram Singh",
    createdAt: "2026-11-17T10:30:00Z",
    updatedAt: "2026-11-18T08:15:00Z",
    description: "Scheduled filter replacement and TDS check."
  },
  {
    id: "req-100",
    customerId: "cust-1",
    customerName: "Asha Sharma",
    applianceId: "app-2",
    applianceLabel: "Daikin FTKM50 1.5 Ton",
    serviceType: "repair",
    status: "completed",
    assignedTechnicianName: "Rajesh Kumar",
    createdAt: "2026-10-12T14:00:00Z",
    updatedAt: "2026-10-13T16:30:00Z",
    description: "Cooling coil cleaning and refrigerant check."
  }
];

const schedule = [
  { id: "sch-1", dueOn: "2026-12-05", expiresOn: "2027-03-14", applianceLabel: "Kent Grand Plus RO 9L", workflowStatus: "confirmed", requestId: "req-101", status: "due" },
  { id: "sch-2", dueOn: "2027-01-15", expiresOn: "2027-05-09", applianceLabel: "Daikin FTKM50 1.5 Ton", workflowStatus: "scheduled", status: "due" }
];

const renewals = [
  { id: "ren-1", status: "awaiting_customer", pricePaise: 249900, planName: "Kent Comprehensive AMC (1 Year)" }
];

const dashboardMarkup = renderToStaticMarkup(
  React.createElement(CustomerHome, {
    profile,
    overview,
    requests,
    openRequests: "1",
    schedule,
    moreSchedule: false,
    renewals
  })
);

const shellMarkup = `
<div class="workspace">
  <aside class="sidebar">
    <div class="brand"><span></span>iTech</div>
    <div class="workspace-label">Customer workspace</div>
    <nav aria-label="Main navigation">
      <a class="nav-link active" href="/customer"><span aria-hidden="true">▦</span>Overview</a>
      <a class="nav-link" href="/customer/profile"><span aria-hidden="true">◈</span>My profile</a>
      <a class="nav-link" href="/customer/appliances"><span aria-hidden="true">◇</span>My appliances</a>
      <a class="nav-link" href="/customer/service-requests"><span aria-hidden="true">◷</span>My services</a>
      <a class="nav-link" href="/customer/service-packages"><span aria-hidden="true">▦</span>Service catalogue</a>
      <a class="nav-link" href="/customer/service-plans"><span aria-hidden="true">◈</span>My service plans</a>
      <a class="nav-link" href="/customer/lifecycle"><span aria-hidden="true">◷</span>Care &amp; renewals</a>
    </nav>
    <div class="sidebar-bottom">
      <div class="sidebar-note"><span class="status-dot"></span> A simpler way to serve<p>Your service workspace starts here.</p></div>
      <button class="logout-button">Sign out</button>
    </div>
  </aside>
  <div class="workspace-body">
    <main class="dashboard-main">${dashboardMarkup}</main>
  </div>
</div>
`;

const frameMarkup = renderToStaticMarkup(
  React.createElement(CustomerHomeFrame, null, React.createElement("div", { dangerouslySetInnerHTML: { __html: shellMarkup } }))
);

let rawCss = readFileSync("src/components/customer-home/home.module.css", "utf8");
rawCss = rawCss.replace(/:global\(([^)]+)\)/g, "$1");
rawCss = rawCss.replace(/url\('\/itech-logo\.jpeg'\)/g, `url('${logoBase64}')`);

// Compile genuine globals.scss
const compiledGlobals = sass.compile("src/app/globals.scss").css;

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>iTech V2 — Customer Home</title>
  <style>
    ${compiledGlobals}
    ${rawCss}
  </style>
</head>
<body>
  ${frameMarkup}
</body>
</html>`;

writeFileSync("scripts/preview.html", fullHtml);
console.log("preview.html compiled with real globals.scss!");
