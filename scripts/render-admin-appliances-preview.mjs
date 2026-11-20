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

const icons = load("src/components/admin-dashboard/icons.tsx", { "react/jsx-runtime": JsxRuntime });
const logoBase64 = "data:image/jpeg;base64," + readFileSync("public/itech-logo.jpeg").toString("base64");

const base = {
  "react/jsx-runtime": JsxRuntime,
  "next/link": {
    default: ({ children, href, className, ...props }) =>
      React.createElement("a", { href, className, ...props }, children),
  },
  "next/image": {
    default: ({ alt, className, style }) =>
      React.createElement("img", { alt, src: logoBase64, className, style }),
  },
  "./appliances.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
  "@/components/admin-dashboard/icons": icons,
  "./icons": icons,
  "@/lib/appliances/data": {
    applianceTypes: { ac: "Air conditioner", water_purifier: "Water purifier" },
  },
  "@/lib/service-requests/data": {
    requestStatuses: {
      pending: "Pending",
      in_progress: "In progress",
      completed: "Completed",
      cancelled: "Cancelled",
    },
    serviceTypes: {
      installation: "Installation",
      maintenance: "Maintenance",
      repair: "Repair / complaint",
    },
  },
};

const shared = load("src/components/admin-appliances/shared.tsx", base);
const { ApplianceInventory } = load("src/components/admin-appliances/inventory.tsx", {
  ...base,
  "./shared": shared,
});
const { AdminApplianceDetails } = load("src/components/admin-appliances/details.tsx", {
  ...base,
  "./shared": shared,
});
const { AdminShell } = load("src/components/admin-dashboard/shell.tsx", {
  ...base,
  react: React,
  "./dashboard.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
  "@/components/logout-button": { LogoutButton: () => React.createElement("button", { className: "logout" }, "Sign out") },
  "next/navigation": { usePathname: () => "/admin/appliances" },
});

// Mock inventory data
const mockInventoryData = {
  items: [
    {
      id: "app-1",
      customerId: "cust-1",
      customerName: "Ruchita Sharma",
      customerPhone: "+91 98765 43210",
      customerEmail: "ruchita@example.com",
      customerCity: "Pune",
      type: "ac",
      brand: "Daikin",
      model: "FTKF50 Inverter 1.5T",
      serialNumber: "DKN-2024-883921",
      purchaseDate: "2024-03-10",
      installationDate: "2024-03-15",
      notes: "Installed in master bedroom 2nd floor, outdoor unit on terrace",
      active: true,
      createdAt: "2024-03-15T10:00:00.000Z",
      updatedAt: "2024-03-15T10:00:00.000Z",
      plan: {
        id: "plan-1",
        name: "Total AC Care Plan",
        status: "active",
        startsOn: "2024-03-15",
        expiresOn: "2025-03-14",
        totalServices: 3,
        usedServices: 1,
        remainingServices: 2,
      },
    },
    {
      id: "app-2",
      customerId: "cust-2",
      customerName: "Amit Patel",
      customerPhone: "+91 98234 56789",
      customerEmail: "amit@example.com",
      customerCity: "Mumbai",
      type: "water_purifier",
      brand: "Kent",
      model: "Grand Plus RO+UV 9L",
      serialNumber: "KNT-RO-2023-99",
      purchaseDate: "2023-08-20",
      installationDate: "2023-08-22",
      notes: "Wall mounted in kitchen next to main RO water inlet",
      active: true,
      createdAt: "2023-08-22T11:00:00.000Z",
      updatedAt: "2023-08-22T11:00:00.000Z",
      plan: {
        id: "plan-2",
        name: "PureLife Annual AMC",
        status: "active",
        startsOn: "2024-08-22",
        expiresOn: "2025-08-21",
        totalServices: 4,
        usedServices: 2,
        remainingServices: 2,
      },
    },
    {
      id: "app-3",
      customerId: "cust-3",
      customerName: "Sneha Rao",
      customerPhone: "+91 91234 56780",
      customerEmail: "sneha.rao@example.com",
      customerCity: "Bengaluru",
      type: "ac",
      brand: "Voltas",
      model: "Vectra 185V Inverter",
      serialNumber: "VLT-2022-7711",
      purchaseDate: "2022-04-05",
      installationDate: "2022-04-10",
      notes: "Living room installation",
      active: true,
      createdAt: "2022-04-10T09:00:00.000Z",
      updatedAt: "2022-04-10T09:00:00.000Z",
      plan: {
        id: "plan-3",
        name: "Standard AC Care",
        status: "expired",
        startsOn: "2023-04-10",
        expiresOn: "2024-04-09",
        totalServices: 2,
        usedServices: 2,
        remainingServices: 0,
      },
    },
    {
      id: "app-4",
      customerId: "cust-4",
      customerName: "Vikram Malhotra",
      customerPhone: "+91 99887 66554",
      customerEmail: "vikram@example.com",
      customerCity: "Delhi NCR",
      type: "water_purifier",
      brand: "Aquaguard",
      model: "Geneus Alkaline RO",
      serialNumber: "AQG-2024-0012",
      purchaseDate: "2024-06-12",
      installationDate: "2024-06-14",
      notes: "Commercial office pantry",
      active: true,
      createdAt: "2024-06-14T14:30:00.000Z",
      updatedAt: "2024-06-14T14:30:00.000Z",
      plan: null,
    },
  ],
  matched: 4,
  nextCursor: null,
  cursor: "",
  query: "",
  typeFilter: "all",
  coverageFilter: "all",
  metrics: {
    total: 4,
    ac: 2,
    waterPurifier: 2,
    activeCoverage: 2,
    expiredCoverage: 1,
  },
};

// Mock detail data
const mockDetailData = {
  customer: {
    id: "cust-1",
    ownerUid: "auth-1",
    fullName: "Ruchita Sharma",
    phone: "9876543210",
    alternatePhone: "9876543211",
    email: "ruchita@example.com",
    address: "Flat 402, Skyline Towers, Baner High Street",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411045",
    active: true,
    createdAt: "2024-01-10T10:00:00.000Z",
    updatedAt: "2024-01-10T10:00:00.000Z",
  },
  appliance: {
    id: "app-1",
    customerId: "cust-1",
    type: "ac",
    brand: "Daikin",
    model: "FTKF50 Inverter 1.5T",
    serialNumber: "DKN-2024-883921",
    purchaseDate: "2024-03-10",
    installationDate: "2024-03-15",
    notes: "Installed in master bedroom 2nd floor, outdoor unit on terrace. Copper piping extended 4m.",
    active: true,
    createdAt: "2024-03-15T10:00:00.000Z",
    updatedAt: "2024-03-15T10:00:00.000Z",
  },
  plans: {
    items: [
      {
        id: "plan-1",
        name: "Total AC Care Plan",
        status: "active",
        startsOn: "2024-03-15",
        expiresOn: "2025-03-14",
        totalServices: 3,
        usedServices: 1,
        remainingServices: 2,
        expiredServices: 0,
        packageId: "pkg-1",
        renewedFrom: null,
        createdAt: "2024-03-15T10:00:00.000Z",
      },
    ],
    nextCursor: null,
  },
  requests: [
    {
      id: "req-1",
      customerId: "cust-1",
      customerName: "Ruchita Sharma",
      applianceId: "app-1",
      applianceLabel: "Daikin FTKF50",
      serviceType: "maintenance",
      status: "in_progress",
      description: "Pre-summer deep cleaning, coil descaling, and refrigerant pressure check.",
      createdAt: "2026-11-18T10:00:00.000Z",
      updatedAt: "2026-11-18T14:00:00.000Z",
      assignedTechnicianUid: "tech-1",
      assignedTechnicianName: "Vikram Singh",
      assignmentVersion: 1,
      assignmentUpdatedAt: "2026-11-18T10:30:00.000Z",
      servicePlanId: "plan-1",
      servicePlanName: "Total AC Care Plan",
      servicePlanOutcome: "covered",
      servicePlanCreditUsed: true,
    },
    {
      id: "req-2",
      customerId: "cust-1",
      customerName: "Ruchita Sharma",
      applianceId: "app-1",
      applianceLabel: "Daikin FTKF50",
      serviceType: "installation",
      status: "completed",
      description: "Initial commissioning, vacuum test, wall bracket mounting.",
      createdAt: "2024-03-15T11:00:00.000Z",
      updatedAt: "2024-03-15T13:00:00.000Z",
      assignedTechnicianUid: "tech-2",
      assignedTechnicianName: "Rajesh Kumar",
      assignmentVersion: 1,
      assignmentUpdatedAt: "2024-03-15T11:00:00.000Z",
      servicePlanId: null,
      servicePlanName: "",
      servicePlanOutcome: "",
      servicePlanCreditUsed: false,
    },
  ],
};

const adminProfile = {
  uid: "admin-1",
  role: "admin",
  displayName: "Admin Operator",
};

// Render Inventory inside Admin Shell
const inventoryMarkup = renderToStaticMarkup(
  React.createElement(
    AdminShell,
    { profile: adminProfile },
    React.createElement(ApplianceInventory, { data: mockInventoryData })
  )
);

// Render Details inside Admin Shell
const detailsMarkup = renderToStaticMarkup(
  React.createElement(
    AdminShell,
    { profile: adminProfile },
    React.createElement(AdminApplianceDetails, { data: mockDetailData })
  )
);

const compiledGlobals = sass.compile("src/app/globals.scss").css;

let rawDashboardCss = readFileSync("src/components/admin-dashboard/dashboard.module.css", "utf8");
rawDashboardCss = rawDashboardCss.replace(/:global\(([^)]+)\)/g, "$1");

let rawAppliancesCss = readFileSync("src/components/admin-appliances/appliances.module.css", "utf8");

function generateHtml(bodyMarkup, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${title}</title>
  <style>
    ${compiledGlobals}
    ${rawDashboardCss}
    ${rawAppliancesCss}
  </style>
</head>
<body>
  ${bodyMarkup}
</body>
</html>`;
}

writeFileSync("scripts/preview-admin-appliances-list.html", generateHtml(inventoryMarkup, "iTech V2 — Admin Appliance Management"));
writeFileSync("scripts/preview-admin-appliances-details.html", generateHtml(detailsMarkup, "iTech V2 — Admin Appliance Details"));
console.log("preview-admin-appliances-list.html and preview-admin-appliances-details.html generated successfully!");
