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

const iconsMock = {
  HomeIcon: ({ name }) => React.createElement("span", { "data-icon": name }, name),
};

const cssMock = new Proxy(
  { default: new Proxy({}, { get: (_, p) => String(p) }) },
  { get: (t, p) => (p in t ? t[p] : String(p)) }
);

const serviceData = {
  serviceTypes: {
    maintenance: "Maintenance",
    repair: "Repair / complaint",
    installation: "Installation",
  },
  requestStatuses: {
    pending: "Pending",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  },
  validateServiceRequest: input => ({ data: input, errors: {} }),
};

const requestsViewModule = load("src/components/customer-requests/customer-requests-view.tsx", {
  "react": React,
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "@/lib/service-requests/data": serviceData,
  "@/components/customer-home/icons": iconsMock,
  "./requests.module.css": cssMock,
});

const trackerModule = load("src/components/customer-requests/customer-request-tracker.tsx", {
  "react": React,
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "@/lib/service-requests/data": serviceData,
  "@/components/customer-home/icons": iconsMock,
  "./requests.module.css": cssMock,
});

const formModule = load("src/components/customer-requests/customer-request-form-view.tsx", {
  "react": React,
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "next/navigation": { useRouter: () => ({ push: () => {}, refresh: () => {} }) },
  "@/lib/service-requests/data": serviceData,
  "@/components/customer-home/icons": iconsMock,
  "./requests.module.css": cssMock,
});

const { CustomerRequestsView } = requestsViewModule;
const { CustomerRequestTracker } = trackerModule;
const { CustomerRequestFormView } = formModule;

test("CustomerRequestsView renders empty state when no requests exist", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CustomerRequestsView, { items: [] })
  );
  assert.match(markup, /No service requests yet/);
  assert.match(markup, /View my appliances/);
});

test("CustomerRequestsView renders request list with status badges and links", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CustomerRequestsView, {
      items: [
        {
          id: "req-001",
          customerId: "cust-1",
          customerName: "Asha Sharma",
          applianceId: "app-ro-1",
          applianceLabel: "Kent Grand Plus RO 9L",
          serviceType: "maintenance",
          status: "in_progress",
          assignedTechnicianName: "Vikram Singh",
          description: "Routine filter change and TDS check.",
          createdAt: "2026-11-18T10:00:00Z",
          updatedAt: "2026-11-18T11:30:00Z",
          servicePlanName: "Comprehensive RO Care",
        },
        {
          id: "req-002",
          customerId: "cust-1",
          customerName: "Asha Sharma",
          applianceId: "app-ac-1",
          applianceLabel: "Daikin 1.5T Inverter AC",
          serviceType: "repair",
          status: "pending",
          assignedTechnicianName: null,
          description: "Water leaking from indoor cooling unit.",
          createdAt: "2026-11-19T08:00:00Z",
          updatedAt: "2026-11-19T08:00:00Z",
        },
      ],
    })
  );

  assert.match(markup, /Kent Grand Plus RO 9L/);
  assert.match(markup, /Maintenance/);
  assert.match(markup, /In progress/);
  assert.match(markup, /Vikram Singh/);
  assert.match(markup, /Comprehensive RO Care/);
  assert.match(markup, /Daikin 1.5T Inverter AC/);
  assert.match(markup, /Repair \/ complaint/);
  assert.match(markup, /Pending/);
  assert.match(markup, /Assigning technician/);
  assert.match(markup, /href="\/customer\/service-requests\/req-001"/);
  assert.match(markup, /href="\/customer\/service-requests\/req-002"/);
});

test("CustomerRequestTracker renders 4-step progress and assigned technician details", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CustomerRequestTracker, {
      item: {
        id: "req-12345",
        customerId: "cust-1",
        customerName: "Asha Sharma",
        applianceId: "app-ro-1",
        applianceLabel: "Kent Grand Plus RO 9L",
        serviceType: "maintenance",
        status: "in_progress",
        assignedTechnicianName: "Vikram Singh",
        assignedTechnicianUid: "tech-1",
        assignmentUpdatedAt: "2026-11-18T10:30:00Z",
        description: "Annual maintenance service visit.",
        createdAt: "2026-11-18T09:00:00Z",
        updatedAt: "2026-11-18T11:00:00Z",
        servicePlanId: "plan-1",
        servicePlanName: "Comprehensive RO Annual Care",
        servicePlanOutcome: "pending",
        servicePlanCreditUsed: false,
      },
      saved: true,
    })
  );

  assert.match(markup, /Your service request was submitted successfully/);
  assert.match(markup, /Maintenance Request/);
  assert.match(markup, /Kent Grand Plus RO 9L/);
  assert.match(markup, /In progress/);
  assert.match(markup, /Request Placed/);
  assert.match(markup, /Technician Assigned/);
  assert.match(markup, /In Progress/);
  assert.match(markup, /Completed/);
  assert.match(markup, /Vikram Singh/);
  assert.match(markup, /Certified iTech Service Technician/);
  assert.match(markup, /Comprehensive RO Annual Care/);
  assert.match(markup, /1 visit will be deducted only after successful completion/);
});

test("CustomerRequestTracker renders cancellation notice when request is cancelled", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CustomerRequestTracker, {
      item: {
        id: "req-99999",
        customerId: "cust-1",
        customerName: "Asha Sharma",
        applianceId: "app-ac-1",
        applianceLabel: "Daikin AC",
        serviceType: "repair",
        status: "cancelled",
        assignedTechnicianName: null,
        description: "Customer cancelled booking.",
        createdAt: "2026-11-17T09:00:00Z",
        updatedAt: "2026-11-17T10:00:00Z",
      },
    })
  );

  assert.match(markup, /Service request cancelled/);
  assert.match(markup, /No maintenance visits were deducted/);
});

test("CustomerRequestFormView renders free maintenance and complaint variants", () => {
  const freeMarkup = renderToStaticMarkup(
    React.createElement(CustomerRequestFormView, {
      customerId: "cust-1",
      applianceId: "app-ro-1",
      customerName: "Asha Sharma",
      applianceLabel: "Kent Grand Plus RO 9L",
      initialType: "maintenance",
      freeBooking: true,
    })
  );

  assert.match(freeMarkup, /Book Free Maintenance/);
  assert.match(freeMarkup, /Included Maintenance Booking/);
  assert.match(freeMarkup, /Kent Grand Plus RO 9L/);

  const complaintMarkup = renderToStaticMarkup(
    React.createElement(CustomerRequestFormView, {
      customerId: "cust-1",
      applianceId: "app-ac-1",
      customerName: "Asha Sharma",
      applianceLabel: "Daikin Split AC",
      initialType: "repair",
      freeBooking: false,
    })
  );

  assert.match(complaintMarkup, /Report a Complaint/);
  assert.match(complaintMarkup, /Complaint \/ Repair Request/);
});
