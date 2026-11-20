import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as sass from "sass";
import ts from "typescript";

function load(file, dependencies) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, {
    module: testModule,
    exports: testModule.exports,
    require(name) {
      if (!(name in dependencies)) throw Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  });
  return testModule.exports;
}

const icons = load("src/components/customer-home/icons.tsx", { "react/jsx-runtime": JsxRuntime });
const logoBase64 = "data:image/jpeg;base64," + readFileSync("public/itech-logo.jpeg").toString("base64");

const base = {
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, href, className, ...props }) => React.createElement("a", { href, className, ...props }, children) },
  "./appliances.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
  "@/components/customer-home/icons": icons,
  "./icons": icons,
  "@/lib/appliances/data": { applianceTypes: { ac: "Air conditioner", water_purifier: "Water purifier" } },
  "@/lib/service-requests/data": {
    requestStatuses: { pending: "Pending", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" },
    serviceTypes: { installation: "Installation", maintenance: "Maintenance", repair: "Repair / complaint" },
  },
};

const { CustomerApplianceList } = load("src/components/customer-appliances/customer-appliance-list.tsx", {
  ...base,
  react: React,
});

const { CustomerApplianceDetailsView } = load("src/components/customer-appliances/customer-appliance-details.tsx", base);

const { CustomerHomeFrame } = load("src/components/customer-home/home-frame.tsx", {
  ...base,
  "./home.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
  "next/navigation": { usePathname: () => "/customer/appliances" },
});

const mockAppliance1 = {
  id: "app-ro-1",
  customerId: "cust-1",
  type: "water_purifier",
  brand: "Kent",
  model: "Grand Plus RO 9L",
  serialNumber: "WP-2024-KNT9L",
  purchaseDate: "2024-03-10",
  installationDate: "2024-03-15",
  notes: "Wall mounted in kitchen next to main inlet",
  active: true,
  createdAt: "2024-03-15T10:00:00.000Z",
  updatedAt: "2024-03-15T10:00:00.000Z",
};

const mockAppliance2 = {
  id: "app-ac-2",
  customerId: "cust-1",
  type: "ac",
  brand: "Daikin",
  model: "FTKM50 1.5 Ton 5-Star",
  serialNumber: "AC-DKN-2023",
  purchaseDate: "2023-05-01",
  installationDate: "2023-05-10",
  notes: "Master bedroom split inverter AC",
  active: true,
  createdAt: "2023-05-10T12:00:00.000Z",
  updatedAt: "2023-05-10T12:00:00.000Z",
};

const mockPlan1 = {
  id: "plan-1",
  name: "Comprehensive RO Care (1 Year)",
  status: "active",
  startsOn: "2024-03-15",
  expiresOn: "2025-03-14",
  totalServices: 3,
  usedServices: 2,
  remainingServices: 1,
  expiredServices: 0,
};

const mockPlan2 = {
  id: "plan-2",
  name: "Annual AC Maintenance Plan",
  status: "active",
  startsOn: "2024-05-10",
  expiresOn: "2025-05-09",
  totalServices: 2,
  usedServices: 1,
  remainingServices: 1,
  expiredServices: 0,
};

const mockRequests = [
  {
    id: "req-101",
    customerId: "cust-1",
    customerName: "Asha Sharma",
    applianceId: "app-ro-1",
    applianceLabel: "Kent Grand Plus RO 9L",
    serviceType: "maintenance",
    status: "in_progress",
    assignedTechnicianName: "Vikram Singh",
    createdAt: "2026-11-17T10:30:00Z",
    updatedAt: "2026-11-18T08:15:00Z",
    description: "Scheduled filter replacement and TDS membrane calibration.",
  },
  {
    id: "req-99",
    customerId: "cust-1",
    customerName: "Asha Sharma",
    applianceId: "app-ro-1",
    applianceLabel: "Kent Grand Plus RO 9L",
    serviceType: "installation",
    status: "completed",
    assignedTechnicianName: "Rajesh Kumar",
    createdAt: "2024-03-15T09:00:00Z",
    updatedAt: "2024-03-15T11:00:00Z",
    description: "Initial home installation and electrical safety check.",
  },
];

// Markup for list view
const listMarkup = renderToStaticMarkup(
  React.createElement(CustomerApplianceList, {
    customer: { active: true },
    items: [
      { appliance: mockAppliance1, current: mockPlan1, upcoming: null },
      { appliance: mockAppliance2, current: mockPlan2, upcoming: null },
    ],
    nextCursor: null,
  })
);

// Markup for details view
const detailsMarkup = renderToStaticMarkup(
  React.createElement(CustomerApplianceDetailsView, {
    appliance: mockAppliance1,
    currentPlan: mockPlan1,
    upcomingPlan: null,
    planHistory: [],
    requests: mockRequests,
  })
);

function wrapInShell(content) {
  return `
<div class="workspace">
  <aside class="sidebar">
    <div class="brand"><span></span>iTech</div>
    <div class="workspace-label">Customer workspace</div>
    <nav aria-label="Main navigation">
      <a class="nav-link" href="/customer"><span aria-hidden="true">▦</span>Overview</a>
      <a class="nav-link" href="/customer/profile"><span aria-hidden="true">◈</span>My profile</a>
      <a class="nav-link active" href="/customer/appliances"><span aria-hidden="true">◇</span>My appliances</a>
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
    <main class="dashboard-main">${content}</main>
  </div>
</div>
`;
}

const listFrameMarkup = renderToStaticMarkup(
  React.createElement(CustomerHomeFrame, null, React.createElement("div", { dangerouslySetInnerHTML: { __html: wrapInShell(listMarkup) } }))
);

const detailsFrameMarkup = renderToStaticMarkup(
  React.createElement(CustomerHomeFrame, null, React.createElement("div", { dangerouslySetInnerHTML: { __html: wrapInShell(detailsMarkup) } }))
);

const compiledGlobals = sass.compile("src/app/globals.scss").css;

let rawHomeCss = readFileSync("src/components/customer-home/home.module.css", "utf8");
rawHomeCss = rawHomeCss.replace(/:global\(([^)]+)\)/g, "$1");
rawHomeCss = rawHomeCss.replace(/url\('\/itech-logo\.jpeg'\)/g, `url('${logoBase64}')`);

let rawAppliancesCss = readFileSync("src/components/customer-appliances/appliances.module.css", "utf8");

function generateHtml(bodyMarkup, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${title}</title>
  <style>
    ${compiledGlobals}
    ${rawHomeCss}
    ${rawAppliancesCss}
  </style>
</head>
<body>
  ${bodyMarkup}
</body>
</html>`;
}

writeFileSync("scripts/preview-appliances-list.html", generateHtml(listFrameMarkup, "iTech V2 — My Appliances"));
writeFileSync("scripts/preview-appliances-details.html", generateHtml(detailsFrameMarkup, "iTech V2 — Appliance Details"));
console.log("preview-appliances-list.html and preview-appliances-details.html generated successfully!");
