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

const plansView = load("src/components/customer-plans/customer-plans-view.tsx", {
  "react": React,
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "@/lib/appliances/data": {
    applianceTypes: { water_purifier: "Water Purifier", ac: "Air Conditioner" },
  },
  "@/lib/service-plans/data": { indiaDate: () => "2026-11-18" },
  "@/components/customer-home/icons": {
    HomeIcon: ({ name }) => React.createElement("span", { "data-icon": name }, name),
  },
  "./plans.module.css": new Proxy(
    { default: new Proxy({}, { get: (_, p) => String(p) }) },
    { get: (t, p) => (p in t ? t[p] : String(p)) }
  ),
});

const { CustomerPlansView } = plansView;

test("CustomerPlansView renders unlinked profile empty state", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CustomerPlansView, { customer: null, items: [] })
  );
  assert.match(markup, /Your profile is not linked yet/);
  assert.match(markup, /View profile/);
});

test("CustomerPlansView renders no appliances empty state", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CustomerPlansView, { customer: { active: true }, items: [] })
  );
  assert.match(markup, /No appliances added yet/);
  assert.match(markup, /Request an installation/);
});

test("CustomerPlansView displays active plan with maintenance allowance and action buttons", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CustomerPlansView, {
      customer: { active: true },
      items: [
        {
          appliance: {
            id: "app-ro-1",
            brand: "Kent",
            model: "Grand Plus RO",
            type: "water_purifier",
            active: true,
          },
          current: {
            name: "Comprehensive RO Annual Care",
            status: "active",
            remainingServices: 2,
            totalServices: 3,
            usedServices: 1,
            expiresOn: "2027-08-15",
          },
          upcoming: null,
        },
      ],
      renewals: [],
    })
  );

  assert.match(markup, /Kent Grand Plus RO/);
  assert.match(markup, /Comprehensive RO Annual Care/);
  assert.match(markup, /2 visits remaining/);
  assert.match(markup, /Used:.*1 visits/);
  assert.match(markup, /Total included:.*3 visits/);
  assert.match(markup, /Book free maintenance/);
  assert.match(markup, /Report a complaint/);
  assert.match(markup, /Details &amp; plan history/);
  assert.match(markup, /serviceType=maintenance&amp;free=1/);
});

test("CustomerPlansView renders renewal notice awaiting customer agreement", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CustomerPlansView, {
      customer: { active: true },
      items: [
        {
          appliance: {
            id: "app-ac-1",
            brand: "Daikin",
            model: "1.5T Inverter AC",
            type: "ac",
            active: true,
          },
          current: {
            name: "Summer AC Shield",
            status: "active",
            remainingServices: 0,
            totalServices: 2,
            usedServices: 2,
            expiresOn: "2026-12-05",
          },
          upcoming: null,
        },
      ],
      renewals: [
        {
          id: "ren-1",
          applianceId: "app-ac-1",
          planName: "Annual AC Shield Renewal",
          pricePaise: 249900,
          status: "awaiting_customer",
        },
      ],
    })
  );

  assert.match(markup, /Renewal proposal ready for review/);
  assert.match(markup, /Annual AC Shield Renewal/);
  assert.match(markup, /₹2499/);
  assert.match(markup, /Review renewal proposal/);
  // With 0 remaining visits, Book free maintenance must NOT be shown
  assert.doesNotMatch(markup, /Book free maintenance/);
  // Report complaint is still available
  assert.match(markup, /Report a complaint/);
});

test("CustomerPlansView hides free maintenance when plan is expired", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CustomerPlansView, {
      customer: { active: true },
      items: [
        {
          appliance: {
            id: "app-old",
            brand: "LG",
            model: "Dual Cool AC",
            type: "ac",
            active: true,
          },
          current: {
            name: "Expired Protection Plan",
            status: "expired",
            remainingServices: 0,
            totalServices: 2,
            usedServices: 2,
            expiresOn: "2026-01-01",
          },
          upcoming: null,
        },
      ],
    })
  );

  assert.doesNotMatch(markup, /Book free maintenance/);
  assert.match(markup, /Report a complaint/);
  assert.match(markup, /Expired/);
});
