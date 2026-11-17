import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { ApplianceStoreError } from "../scripts/appliance-store.mjs";
function load(file, dependencies = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, { module: testModule, exports: testModule.exports, ...globals,
    require(name) { if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name); return dependencies[name]; },
  }, { filename: file });
  return testModule.exports;
}
const validation = load("src/lib/appliances/data.ts");
const valid = { type: "water_purifier", brand: "Test Brand", model: "Model One", serialNumber: "ABC-123", purchaseDate: "2026-01-01", installationDate: "2026-01-02", notes: "", active: true };
test("appliance validation normalizes brand spaces and serial case/spaces", () => {
  const result = validation.validateAppliance({ ...valid, brand: " Test  Brand ", serialNumber: " abc 123 " });
  assert.equal(result.data.brand, "Test Brand"); assert.equal(result.data.serialNumber, "ABC123");
});
for (const type of ["water_purifier", "ac"]) {
  test(type + " allows optional serial and dates", () => {
    assert.ok(validation.validateAppliance({ ...valid, type, serialNumber: "", purchaseDate: "", installationDate: "" }).data);
  });
}
for (const [key, value] of [
  ["type", "fridge"], ["brand", ""], ["brand", "   "], ["brand", "A/B"], ["brand", "A|B"], ["brand", "x".repeat(81)],
  ["model", ""], ["model", "x".repeat(101)], ["serialNumber", "A/B"], ["serialNumber", "x".repeat(81)],
  ["serialNumber", 123], ["purchaseDate", "2026-02-30"], ["purchaseDate", "2025-02-29"],
  ["installationDate", "2025-12-31"], ["notes", "x".repeat(1001)], ["active", "true"],
]) {
  test("appliance validation rejects invalid " + key + ": " + String(value).slice(0, 25), () => { assert.equal(validation.validateAppliance({ ...valid, [key]: value }).data, null); });
}
test("leap day dates are accepted in a leap year", () => {
  assert.ok(validation.validateAppliance({ ...valid, purchaseDate: "2024-02-29", installationDate: "2024-03-01" }).data);
});
test("appliance validation strips spoofed ownership and audit fields", () => {
  const result = validation.validateAppliance({ ...valid, customerId: "victim", ownerUid: "victim", createdBy: "forged" });
  for (const key of ["customerId", "ownerUid", "createdBy"]) assert.equal(key in result.data, false);
});
function fixture(role, detail = false, options = {}) {
  const calls = [];
  const service = {
    ApplianceStoreError,
    listAppliances: async (profile, customerId) => { calls.push({ action: "list", profile, customerId }); if (options.denied) throw new Error("Denied"); return { items: [], nextCursor: null }; },
    getAppliance: async (profile, customerId, id) => { calls.push({ action: "get", profile, customerId, id }); return null; },
    persistAppliance: async (profile, customerId, input, id) => { calls.push({ action: "save", profile, customerId, input, id }); if (options.duplicate) throw new ApplianceStoreError("duplicate-serial"); return "synthetic-appliance"; },
    customerAppliances: async profile => { calls.push({ action: "own", profile }); return { customer: null, items: [], nextCursor: null }; },
  };
  const http = load("src/lib/appliances/http.ts", {
    "server-only": {}, "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "./server": service, "@/lib/customers/http": { customerError: () => Response.json({ error: "Denied" }, { status: 403 }) },
  });
  const file = options.own ? "src/app/api/customer/appliances/route.ts" : "src/app/api/customers/[id]/appliances/" + (detail ? "[applianceId]/" : "") + "route.ts";
  const route = load(file, {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/auth": { currentProfile: async () => role ? { uid: "session-user", role } : null },
    "@/lib/request-security": { sameOrigin: req => req.headers.get("origin") === "http://localhost:3001" },
    "@/lib/customers/http": { customerBody: req => req.json() },
    "@/lib/appliances/data": validation, "@/lib/appliances/server": service, "@/lib/appliances/http": http,
  }, { URL });
  return { route, calls };
}
const context = { params: Promise.resolve({ id: "trusted-parent", applianceId: "record" }) };
function request(method, body = valid, origin = "http://localhost:3001") {
  return new Request("http://localhost:3001/api/customers/trusted-parent/appliances", { method, headers: { Origin: origin }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
}
for (const role of [null, "customer", "technician"]) {
  for (const method of ["POST", "PATCH"]) {
    test((role || "unauthenticated") + " cannot " + method + " appliances", async () => {
      const { route, calls } = fixture(role, method === "PATCH");
      assert.equal((await route[method](request(method), context)).status, role ? 403 : 401); assert.equal(calls.length, 0);
    });
  }
}
for (const detail of [false, true]) {
  test("Technician cannot read " + (detail ? "one appliance" : "the appliance list"), async () => {
    const { route, calls } = fixture("technician", detail);
    assert.equal((await route.GET(request("GET"), context)).status, 403); assert.equal(calls.length, 0);
  });
}
test("appliance writes reject cross-origin requests", async () => {
  const { route, calls } = fixture("admin");
  assert.equal((await route.POST(request("POST", valid, "https://untrusted.example"), context)).status, 403); assert.equal(calls.length, 0);
});
test("invalid appliance input returns 400 before persistence", async () => {
  const { route, calls } = fixture("admin");
  assert.equal((await route.POST(request("POST", { ...valid, brand: "" }), context)).status, 400); assert.equal(calls.length, 0);
});
test("Admin appliance creation uses path customer and session Admin, ignoring forged fields", async () => {
  const { route, calls } = fixture("admin");
  assert.equal((await route.POST(request("POST", { ...valid, customerId: "victim", operatorUid: "forged" }), context)).status, 201);
  assert.equal(calls[0].customerId, "trusted-parent"); assert.equal(calls[0].profile.uid, "session-user"); assert.equal("customerId" in calls[0].input, false);
});
test("duplicate appliance serial returns 409", async () => {
  const { route } = fixture("admin", false, { duplicate: true });
  assert.equal((await route.POST(request("POST"), context)).status, 409);
});
for (const role of [null, "admin", "technician"]) {
  test((role || "unauthenticated") + " cannot use Customer own-appliances endpoint", async () => {
    const { route, calls } = fixture(role, false, { own: true });
    assert.equal((await route.GET(request("GET"))).status, role ? 403 : 401); assert.equal(calls.length, 0);
  });
}
test("Customer own-appliances endpoint passes the current session identity", async () => {
  const { route, calls } = fixture("customer", false, { own: true });
  assert.equal((await route.GET(request("GET"))).status, 200); assert.equal(calls[0].profile.uid, "session-user");
});
test("real appliance reads authorize the parent before touching appliance storage", async () => {
  let storageTouched = false;
  const server = load("src/lib/appliances/server.ts", {
    "server-only": {}, "@/lib/firebase/admin": { adminServices: () => { storageTouched = true; throw new Error("Unexpected read"); } },
    "@/lib/customers/server": { getCustomer: async () => { throw new Error("Parent denied"); }, ownCustomer: async () => null, CustomerAccessError: Error },
    "../../../scripts/appliance-store.mjs": { ApplianceStoreError, saveAppliance: async () => { throw new Error("Unexpected write"); } },
  });
  await assert.rejects(server.listAppliances({ uid: "customer", role: "customer" }, "other-parent"), /Parent denied/);
  await assert.rejects(server.getAppliance({ uid: "customer", role: "customer" }, "other-parent", "appliance"), /Parent denied/);
  assert.equal(storageTouched, false);
});
