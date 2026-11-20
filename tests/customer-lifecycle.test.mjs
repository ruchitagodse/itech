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

const lifecyclePolicyMock = {
  indiaDate: () => "2026-11-19",
  serviceDueStatus: (row, today = "2026-11-19") => {
    if (row.status === "completed") return "completed";
    return today > row.expiresOn ? "expired" : today > row.dueOn ? "overdue" : today === row.dueOn ? "due" : "upcoming";
  },
};

const lifecycleViewModule = load("src/components/customer-lifecycle/customer-lifecycle-view.tsx", {
  "react": React,
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "next/navigation": { useRouter: () => ({ refresh: () => {} }) },
  "../../../scripts/lifecycle-policy.mjs": lifecyclePolicyMock,
  "./lifecycle.module.css": cssMock,
});

const mockProfile = {
  uid: "usr_cust_001",
  email: "customer@example.com",
  displayName: "Asha Sharma",
  role: "customer",
};

const mockScheduleRows = [
  {
    id: "sch_1",
    customerId: "cust_1",
    applianceId: "app_ro_1",
    planId: "plan_1",
    planName: "Comprehensive RO Care",
    customerName: "Asha Sharma",
    applianceLabel: "Kent Grand Plus RO 9L",
    dueOn: "2026-12-05",
    startsOn: "2026-03-15",
    expiresOn: "2027-03-14",
    visit: 1,
    status: "due",
    workflowStatus: "scheduled",
    requestId: null,
  },
];

const mockRenewalRows = [
  {
    id: "ren_1",
    customerId: "cust_1",
    applianceId: "app_ro_1",
    planName: "Kent Comprehensive AMC (1 Year)",
    applianceLabel: "Kent Grand Plus RO 9L",
    pricePaise: 249900,
    status: "awaiting_customer",
    startsOn: "2027-03-15",
    expiresOn: "2028-03-14",
    version: 1,
    notes: "Proactive 1-year annual coverage renewal offer.",
  },
];

const mockNotificationRows = [
  {
    id: "notif_1",
    recipientUid: "usr_cust_001",
    kind: "maintenance_due",
    phone: "+919876543210",
    providerId: "sms_gateway",
    attempts: 1,
    createdAt: "2026-11-15T09:00:00.000Z",
  },
];

const mockConsent = {
  phone: "+919876543210",
  enabled: true,
};

test("customer lifecycle view renders title, kicker, and 3 customer tabs", () => {
  const html = renderToStaticMarkup(
    React.createElement(lifecycleViewModule.CustomerLifecycleView, {
      profile: mockProfile,
      view: "maintenanceSchedule",
      items: mockScheduleRows,
      nextCursor: null,
      cursor: "",
      consent: mockConsent,
    })
  );

  assert.match(html, /CARE &amp; RENEWALS/);
  assert.match(html, /Service Lifecycle/);
  assert.match(html, /Service Calendar/);
  assert.match(html, /Renewals &amp; Offers/);
  assert.match(html, /Alert History/);
});

test("customer lifecycle view renders maintenance schedule with target due dates and free service booking CTA", () => {
  const html = renderToStaticMarkup(
    React.createElement(lifecycleViewModule.CustomerLifecycleView, {
      profile: mockProfile,
      view: "maintenanceSchedule",
      items: mockScheduleRows,
      nextCursor: null,
      cursor: "",
      consent: mockConsent,
    })
  );

  assert.match(html, /Kent Grand Plus RO 9L/);
  assert.match(html, /Comprehensive RO Care/);
  assert.match(html, /Visit #1/);
  assert.match(html, /Request Free Maintenance/);
  assert.match(html, /href="\/customer\/service-requests\/new\?applianceId=app_ro_1&amp;serviceType=maintenance&amp;free=1"/);
});

test("customer lifecycle view renders renewal cards with formatted price in INR and Agree/Decline buttons", () => {
  const html = renderToStaticMarkup(
    React.createElement(lifecycleViewModule.CustomerLifecycleView, {
      profile: mockProfile,
      view: "renewals",
      items: mockRenewalRows,
      nextCursor: null,
      cursor: "",
      consent: mockConsent,
    })
  );

  assert.match(html, /Kent Comprehensive AMC \(1 Year\)/);
  assert.match(html, /₹\s*2,499/);
  assert.match(html, /Agree to renewal —/);
  assert.match(html, /Decline/);
});

test("customer lifecycle view renders notification history cards", () => {
  const html = renderToStaticMarkup(
    React.createElement(lifecycleViewModule.CustomerLifecycleView, {
      profile: mockProfile,
      view: "notifications",
      items: mockNotificationRows,
      nextCursor: null,
      cursor: "",
      consent: mockConsent,
    })
  );

  assert.match(html, /maintenance due/i);
  assert.match(html, /\+919876543210/);
  assert.match(html, /sms_gateway/);
});

test("customer lifecycle view renders WhatsApp preference form", () => {
  const html = renderToStaticMarkup(
    React.createElement(lifecycleViewModule.CustomerLifecycleView, {
      profile: mockProfile,
      view: "maintenanceSchedule",
      items: mockScheduleRows,
      nextCursor: null,
      cursor: "",
      consent: mockConsent,
    })
  );

  assert.match(html, /WhatsApp Service Notification Preferences/);
  assert.match(html, /Save WhatsApp Preference/);
});

test("customer lifecycle view renders empty state when no records exist", () => {
  const html = renderToStaticMarkup(
    React.createElement(lifecycleViewModule.CustomerLifecycleView, {
      profile: mockProfile,
      view: "maintenanceSchedule",
      items: [],
      nextCursor: null,
      cursor: "",
      consent: mockConsent,
    })
  );

  assert.match(html, /No scheduled visits/);
  assert.match(html, /View my appliances →/);
});
