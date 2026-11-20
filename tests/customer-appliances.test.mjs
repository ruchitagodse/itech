import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
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

const base = {
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "./appliances.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
  "@/components/customer-home/icons": icons,
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

const mockAppliance1 = {
  id: "app-ro-1",
  customerId: "cust-1",
  type: "water_purifier",
  brand: "Kent",
  model: "Grand Plus RO 9L",
  serialNumber: "WP-2024-KNT9L",
  purchaseDate: "2024-03-10",
  installationDate: "2024-03-15",
  notes: "Wall mounted in kitchen next to sink",
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
  notes: "Master bedroom split unit",
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
    description: "Scheduled filter replacement and membrane check.",
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
    description: "Initial home installation and inlet connection.",
  },
];

test("CustomerApplianceList renders header, counts, filter chips, and appliance cards", () => {
  const html = renderToStaticMarkup(
    React.createElement(CustomerApplianceList, {
      customer: { active: true },
      items: [
        { appliance: mockAppliance1, current: mockPlan1, upcoming: null },
        { appliance: mockAppliance2, current: mockPlan2, upcoming: null },
      ],
      nextCursor: null,
    })
  );

  assert.match(html, /My Appliances/);
  assert.match(html, /2 Appliances/);
  assert.match(html, /All \(2\)/);
  assert.match(html, /Water Purifiers \(1\)/);
  assert.match(html, /Air Conditioners \(1\)/);

  // Card 1
  assert.match(html, /Kent Grand Plus RO 9L/);
  assert.match(html, /WP-2024-KNT9L/);
  assert.match(html, /Comprehensive RO Care/);
  assert.match(html, /1 visit remaining/);
  assert.match(html, /href="\/customer\/appliances\/app-ro-1"/);
  assert.match(html, /href="\/customer\/service-requests\/new\?applianceId=app-ro-1"/);

  // Card 2
  assert.match(html, /Daikin FTKM50 1.5 Ton 5-Star/);
  assert.match(html, /AC-DKN-2023/);
  assert.match(html, /Annual AC Maintenance Plan/);
});

test("CustomerApplianceList renders graceful unlinked profile state", () => {
  const html = renderToStaticMarkup(
    React.createElement(CustomerApplianceList, {
      customer: null,
      items: [],
      nextCursor: null,
    })
  );

  assert.match(html, /Your profile is not linked yet/);
  assert.match(html, /href="\/customer\/profile"/);
});

test("CustomerApplianceList renders polished empty state when no appliances exist", () => {
  const html = renderToStaticMarkup(
    React.createElement(CustomerApplianceList, {
      customer: { active: true },
      items: [],
      nextCursor: null,
    })
  );

  assert.match(html, /No appliances registered yet/);
  assert.match(html, /Request an installation/);
});

test("CustomerApplianceDetailsView renders overview, specs, installation, plan coverage, and service history", () => {
  const html = renderToStaticMarkup(
    React.createElement(CustomerApplianceDetailsView, {
      appliance: mockAppliance1,
      currentPlan: mockPlan1,
      upcomingPlan: null,
      planHistory: [],
      requests: mockRequests,
    })
  );

  // Back link
  assert.match(html, /Back to My Appliances/);
  assert.match(html, /href="\/customer\/appliances"/);

  // Hero
  assert.match(html, /Kent Grand Plus RO 9L/);
  assert.match(html, /SN: WP-2024-KNT9L/);
  assert.match(html, /Active/);

  // Specs & Overview
  assert.match(html, /Appliance overview/);
  assert.match(html, /Water purifier/);
  assert.match(html, /Wall mounted in kitchen next to sink/);

  // Installation
  assert.match(html, /Installation information/);
  assert.match(html, /Installed/);

  // Plan coverage
  assert.match(html, /Service plan coverage/);
  assert.match(html, /Comprehensive RO Care/);
  assert.match(html, /2 of 3 visits used/);
  assert.match(html, /1 visit remaining/);
  assert.match(html, /Book free maintenance/);
  assert.match(html, /serviceType=maintenance&amp;free=1/);

  // Service history
  assert.match(html, /Service history/);
  assert.match(html, /2 Records/);
  assert.match(html, /Maintenance/);
  assert.match(html, /In progress/);
  assert.match(html, /Vikram Singh/);
  assert.match(html, /Installation/);
  assert.match(html, /Completed/);
  assert.match(html, /href="\/customer\/service-requests\/req-101"/);

  // Bottom action banner
  assert.match(html, /Need care for your Kent Grand Plus RO 9L\?/);
  assert.match(html, /Request a service/);
  assert.match(html, /Report a complaint/);
});

test("CustomerApplianceDetailsView displays empty history and no plan states gracefully", () => {
  const html = renderToStaticMarkup(
    React.createElement(CustomerApplianceDetailsView, {
      appliance: { ...mockAppliance1, serialNumber: undefined, notes: undefined },
      currentPlan: null,
      upcomingPlan: null,
      planHistory: [],
      requests: [],
    })
  );

  assert.match(html, /No active service plan attached/);
  assert.match(html, /No service requests recorded for this appliance yet/);
  assert.match(html, /Not recorded/);
});
