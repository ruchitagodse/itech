import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(file, dependencies = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, {
    module: testModule,
    exports: testModule.exports,
    ...globals,
    require(name) {
      if (!(name in dependencies)) throw Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  });
  return testModule.exports;
}

const cssMock = new Proxy(
  { default: new Proxy({}, { get: (_, p) => String(p) }) },
  { get: (t, p) => (p in t ? t[p] : String(p)) }
);

const packagesViewModule = load("src/components/customer-packages/customer-packages-view.tsx", {
  "react": React,
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "@/lib/appliances/data": { applianceTypes: { water_purifier: "Water purifier", ac: "Air conditioner" } },
  "@/lib/service-requests/data": { serviceTypes: { maintenance: "Maintenance", repair: "Repair / complaint", installation: "Installation" } },
  "@/lib/service-packages/data": {
    packagePrice: paise => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100),
  },
  "./packages.module.css": cssMock,
});

const mockPackages = [
  {
    id: "pkg_ro_amc",
    name: "Comprehensive RO Annual Care",
    applianceType: "water_purifier",
    serviceType: "maintenance",
    pricePaise: 249900,
    description: "Complete sediment and carbon filter replacement.\nTDS inspection and membrane check.\nFree breakdown visits during validity.",
    active: true,
    policy: {
      validityMonths: 12,
      maintenanceIntervalMonths: 6,
    },
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "pkg_ac_clean",
    name: "AC Deep Clean & Master Tune-up",
    applianceType: "ac",
    serviceType: "maintenance",
    pricePaise: 149900,
    description: "Indoor blower wash and outdoor condenser coil foam cleaning.\nRefrigerant pressure check and electrical safety audit.",
    active: true,
    policy: {
      validityMonths: 6,
      maintenanceIntervalMonths: 3,
    },
    version: 1,
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
  },
  {
    id: "pkg_ro_install",
    name: "RO Standard Home Installation",
    applianceType: "water_purifier",
    serviceType: "installation",
    pricePaise: 59900,
    description: "Wall mounting and inlet plumbing connection.\nElectrical adapter setup and first water purity testing.",
    active: true,
    policy: null,
    version: 1,
    createdAt: "2026-01-03T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
  },
];

test("customer packages view renders title, kicker, trust banner, and package count", () => {
  const html = renderToStaticMarkup(
    React.createElement(packagesViewModule.CustomerPackagesView, {
      items: mockPackages,
      cursor: "",
      nextCursor: null,
    })
  );

  assert.match(html, /SERVICE CATALOGUE/);
  assert.match(html, /Care &amp; Service Packages/);
  assert.match(html, /3 Packages Available/);
  assert.match(html, /30-Day Service Guarantee/);
  assert.match(html, /100% Genuine Spare Parts/);
  assert.match(html, /Certified Technicians/);
});

test("customer packages view renders package cards with formatted INR price and inclusion items", () => {
  const html = renderToStaticMarkup(
    React.createElement(packagesViewModule.CustomerPackagesView, {
      items: mockPackages,
      cursor: "",
      nextCursor: null,
    })
  );

  assert.match(html, /Comprehensive RO Annual Care/);
  assert.match(html, /₹\s*2,499/);
  assert.match(html, /AC Deep Clean &amp; Master Tune-up/);
  assert.match(html, /₹\s*1,499/);
  assert.match(html, /RO Standard Home Installation/);
  assert.match(html, /₹\s*599/);

  // Inclusions parsed
  assert.match(html, /Complete sediment and carbon filter replacement/);
  assert.match(html, /TDS inspection and membrane check/);
});

test("customer packages view renders policy banner for maintenance plans", () => {
  const html = renderToStaticMarkup(
    React.createElement(packagesViewModule.CustomerPackagesView, {
      items: mockPackages,
      cursor: "",
      nextCursor: null,
    })
  );

  assert.match(html, /12 Months Coverage/);
  assert.match(html, /2 maintenance visits included/);
  assert.match(html, /every 6 mos/);
});

test("customer packages view renders direct booking links with serviceType query params", () => {
  const html = renderToStaticMarkup(
    React.createElement(packagesViewModule.CustomerPackagesView, {
      items: mockPackages,
      cursor: "",
      nextCursor: null,
    })
  );

  assert.match(html, /href="\/customer\/service-requests\/new\?serviceType=maintenance"/);
  assert.match(html, /href="\/customer\/service-requests\/new\?serviceType=installation"/);
  assert.match(html, /Book Maintenance →/);
  assert.match(html, /Schedule Installation →/);
});

test("customer packages view renders empty state when no packages match filters", () => {
  const html = renderToStaticMarkup(
    React.createElement(packagesViewModule.CustomerPackagesView, {
      items: [],
      cursor: "",
      nextCursor: null,
    })
  );

  assert.match(html, /No packages match your selection/);
  assert.match(html, /Clear all filters/);
});

test("customer packages view renders pagination controls when cursor or nextCursor is present", () => {
  const html = renderToStaticMarkup(
    React.createElement(packagesViewModule.CustomerPackagesView, {
      items: mockPackages,
      cursor: "pkg_ro_amc",
      nextCursor: "pkg_ro_install",
      basePath: "/customer/service-packages",
    })
  );

  assert.match(html, /First page/);
  assert.match(html, /Next page →/);
  assert.match(html, /Up to 25 packages per page/);
});
