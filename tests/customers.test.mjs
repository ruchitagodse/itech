import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { CustomerStoreError } from "../scripts/customer-store.mjs";
function load(file, dependencies = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, { module: testModule, exports: testModule.exports, ...globals,
    require(name) { if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name); return dependencies[name]; },
  }, { filename: file });
  return testModule.exports;
}
const validation = load("src/lib/customers/data.ts");
const valid = { fullName: "Test Customer", email: "test@example.invalid", phone: "9876543210", alternatePhone: "", address: "Test address", city: "Pune", state: "Maharashtra", pincode: "411001", active: true };
test("customer validation canonicalizes case and country-code phone", () => {
  const result = validation.validateCustomer({ ...valid, email: " TEST@Example.Invalid ", phone: "+91 (98765) 43210" });
  assert.equal(result.data.email, valid.email); assert.equal(result.data.phone, valid.phone);
});
for (const key of ["fullName", "email", "phone", "address", "city", "state", "pincode"]) {
  test("customer validation requires " + key, () => {
    const result = validation.validateCustomer({ ...valid, [key]: "" });
    assert.equal(result.data, null); assert.ok(result.errors[key]);
  });
}
for (const [key, value] of [["email", "invalid"], ["email", "test/user@example.invalid"], ["phone", "123"], ["phone", "98abc543210"], ["alternatePhone", "bad"], ["pincode", "000000"], ["pincode", "41101"], ["active", "true"]]) {
  test("customer validation rejects invalid " + key + ": " + value, () => { assert.equal(validation.validateCustomer({ ...valid, [key]: value }).data, null); });
}
test("customer validation excludes spoofed owner and audit fields", () => {
  const result = validation.validateCustomer({ ...valid, ownerUid: "victim", createdBy: "forged", role: "admin" });
  assert.equal("ownerUid" in result.data, false); assert.equal("createdBy" in result.data, false); assert.equal("role" in result.data, false);
});
test("customer search normalizes names and country-code phones", () => {
  assert.equal(validation.customerSearchTerm(" Test  Customer "), "test customer");
  assert.equal(validation.customerSearchTerm("+91 98765"), "98765");
});
class AccessError extends Error { constructor(status) { super("Access denied"); this.status = status; } }
function routeFixture(role, file = "src/app/api/customers/route.ts", options = {}) {
  const calls = [];
  const server = { CustomerAccessError: AccessError, CustomerStoreError,
    listCustomers: async profile => { calls.push({ action: "list", uid: profile.uid }); return { items: [], nextCursor: null }; },
    persistCustomer: async (profile, input, id) => { calls.push({ action: "save", uid: profile.uid, input, id }); if (options.duplicate) throw new CustomerStoreError("duplicate-email"); return "synthetic-record"; },
    getCustomer: async (profile, id) => { calls.push({ action: "get", uid: profile.uid, id }); if (profile.role === "technician" || options.otherOwner) throw new AccessError(403); return { id }; },
    ownCustomer: async profile => { calls.push({ action: "own", uid: profile.uid }); return null; },
  };
  const http = load("src/lib/customers/http.ts", { "server-only": {}, "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } }, "./server": server });
  const route = load(file, {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/auth": { currentProfile: async () => role ? { uid: "session-user", role } : null },
    "@/lib/request-security": { sameOrigin: req => req.headers.get("origin") === "http://localhost:3001" },
    "@/lib/customers/data": validation, "@/lib/customers/server": server, "@/lib/customers/http": http,
  }, { URL });
  return { route, calls };
}
function request(method, body = valid, origin = "http://localhost:3001") {
  return new Request("http://localhost:3001/api/customers", { method, headers: { Origin: origin }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
}
for (const role of [null, "customer", "technician"]) {
  test((role || "unauthenticated") + " cannot list customer records", async () => {
    const { route, calls } = routeFixture(role); assert.equal((await route.GET(request("GET"))).status, role ? 403 : 401); assert.equal(calls.length, 0);
  });
  test((role || "unauthenticated") + " cannot create customer records", async () => {
    const { route, calls } = routeFixture(role); assert.equal((await route.POST(request("POST"))).status, role ? 403 : 401); assert.equal(calls.length, 0);
  });
  test((role || "unauthenticated") + " cannot edit customer records", async () => {
    const { route, calls } = routeFixture(role, "src/app/api/customers/[id]/route.ts"); assert.equal((await route.PATCH(request("PATCH"), { params: Promise.resolve({ id: "record" }) })).status, role ? 403 : 401); assert.equal(calls.length, 0);
  });
}
test("customer writes reject cross-origin requests", async () => {
  const { route, calls } = routeFixture("admin"); assert.equal((await route.POST(request("POST", valid, "https://untrusted.example"))).status, 403); assert.equal(calls.length, 0);
});
test("Admin writes are validated and use session identity, ignoring spoofed fields", async () => {
  const { route, calls } = routeFixture("admin");
  assert.equal((await route.POST(request("POST", { ...valid, ownerUid: "victim", createdBy: "forged" }))).status, 201);
  assert.equal(calls[0].uid, "session-user"); assert.equal("ownerUid" in calls[0].input, false);
});
test("invalid customer fields return 400 without persistence", async () => {
  const { route, calls } = routeFixture("admin"); assert.equal((await route.POST(request("POST", { ...valid, phone: "bad" }))).status, 400); assert.equal(calls.length, 0);
});
test("duplicate customer API response returns 409", async () => {
  const { route } = routeFixture("admin", "src/app/api/customers/route.ts", { duplicate: true });
  assert.equal((await route.POST(request("POST"))).status, 409);
});
test("Customer detail API rejects access to a different owner", async () => {
  const { route } = routeFixture("customer", "src/app/api/customers/[id]/route.ts", { otherOwner: true });
  assert.equal((await route.GET(request("GET"), { params: Promise.resolve({ id: "other" }) })).status, 403);
});
for (const role of [null, "admin", "technician"]) {
  test((role || "unauthenticated") + " cannot use the Customer own-profile endpoint", async () => {
    const { route, calls } = routeFixture(role, "src/app/api/customer/profile/route.ts");
    assert.equal((await route.GET()).status, role ? 403 : 401); assert.equal(calls.length, 0);
  });
}
test("own-profile endpoint uses session UID rather than supplied customer identity", async () => {
  const { route, calls } = routeFixture("customer", "src/app/api/customer/profile/route.ts");
  assert.equal((await route.GET()).status, 200); assert.equal(calls[0].uid, "session-user");
});
// Exercise the real data-access functions with an isolated Firestore adapter as well.
test("real customer data access rejects cross-owner and Technician reads", async () => {
  const snapshot = { exists: true, data: () => ({ ownerUid: "another-user" }) };
  const server = load("src/lib/customers/server.ts", {
    "server-only": {}, "@/lib/firebase/admin": { adminServices: () => ({ db: { collection: () => ({ doc: () => ({ get: async () => snapshot }) }) } }) },
    "./data": validation, "../../../scripts/customer-store.mjs": { CustomerStoreError, saveCustomer: async () => { throw new Error("Unexpected write"); } },
  });
  await assert.rejects(server.getCustomer({ uid: "me", role: "customer" }, "other"), error => error.status === 403);
  await assert.rejects(server.getCustomer({ uid: "tech", role: "technician" }, "other"), error => error.status === 403);
});

test("optional phone rejects a non-string value", () => { assert.equal(validation.validateCustomer({ ...valid, alternatePhone: 9876543211 }).data, null); });
