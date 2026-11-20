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

const logoutButtonModule = load("src/components/customer-profile/profile-logout-button.tsx", {
  "react": React,
  "react/jsx-runtime": JsxRuntime,
  "./profile.module.css": cssMock,
});

const profileViewModule = load("src/components/customer-profile/customer-profile-view.tsx", {
  "react": React,
  "react/jsx-runtime": JsxRuntime,
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "./profile-logout-button": logoutButtonModule,
  "./profile.module.css": cssMock,
});

const mockProfile = {
  uid: "usr_cust_001",
  email: "ruchita@example.com",
  displayName: "Ruchita Sharma",
  role: "customer",
};

const mockCustomer = {
  id: "cust_9876543210ab",
  fullName: "Ruchita Sharma",
  email: "ruchita@example.com",
  phone: "9876543210",
  alternatePhone: "9123456789",
  address: "Flat 402, Sunshine Heights, Linking Road",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400050",
  active: true,
  ownerUid: "usr_cust_001",
  createdAt: "2026-01-15T10:00:00.000Z",
  updatedAt: "2026-01-15T10:00:00.000Z",
};

test("customer profile renders full name, initials avatar, email, verified badge, and customer ID", () => {
  const html = renderToStaticMarkup(
    React.createElement(profileViewModule.CustomerProfileView, {
      profile: mockProfile,
      customer: mockCustomer,
    })
  );

  assert.match(html, /Ruchita Sharma/);
  assert.match(html, /RS/); // initials
  assert.match(html, /Verified Customer/);
  assert.match(html, /#CUST_987/); // customer ID prefix
  assert.match(html, /ruchita@example\.com/);
  assert.match(html, /Active/);
});

test("customer profile renders formatted contact numbers and registered service address", () => {
  const html = renderToStaticMarkup(
    React.createElement(profileViewModule.CustomerProfileView, {
      profile: mockProfile,
      customer: mockCustomer,
    })
  );

  // Phone numbers formatted with +91
  assert.match(html, /\+91 98765 43210/);
  assert.match(html, /\+91 91234 56789/);

  // Address fields
  assert.match(html, /Flat 402, Sunshine Heights, Linking Road/);
  assert.match(html, /Mumbai, Maharashtra/);
  assert.match(html, /400050/);
  assert.match(html, /Registered Service Address/);
});

test("customer profile renders connected service hub links (appliances, plans, requests, new request)", () => {
  const html = renderToStaticMarkup(
    React.createElement(profileViewModule.CustomerProfileView, {
      profile: mockProfile,
      customer: mockCustomer,
    })
  );

  assert.match(html, /href="\/customer\/appliances"/);
  assert.match(html, /href="\/customer\/service-plans"/);
  assert.match(html, /href="\/customer\/service-requests"/);
  assert.match(html, /href="\/customer\/service-requests\/new"/);
});

test("customer profile renders customer care support contact and hours", () => {
  const html = renderToStaticMarkup(
    React.createElement(profileViewModule.CustomerProfileView, {
      profile: mockProfile,
      customer: mockCustomer,
    })
  );

  assert.match(html, /href="tel:\+919876543210"/);
  assert.match(html, /href="mailto:care@itech\.in"/);
  assert.match(html, /Mon – Sat: 9:00 AM – 8:00 PM IST/);
});

test("customer profile renders friendly unlinked state when customer record is missing", () => {
  const html = renderToStaticMarkup(
    React.createElement(profileViewModule.CustomerProfileView, {
      profile: mockProfile,
      customer: null,
    })
  );

  assert.match(html, /Your profile is not linked yet/);
  assert.match(html, /ruchita@example\.com/);
  assert.match(html, /Contact your service administrator/);
  assert.match(html, /Call Support: \+91 98765 43210/);
});

test("profile logout button renders sign out action button", () => {
  const html = renderToStaticMarkup(
    React.createElement(logoutButtonModule.ProfileLogoutButton)
  );

  assert.match(html, /Sign out of iTech/);
});
