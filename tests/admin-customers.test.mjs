import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { planBalance } from "../scripts/service-plan-dates.mjs";
function load(file, dependencies = {}) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, { module: testModule, exports: testModule.exports, require(name) { if (!(name in dependencies)) throw Error("Unexpected dependency: " + name); return dependencies[name]; } });
  return testModule.exports;
}
const projections = load("src/lib/admin-customers/projections.ts");
const relationship = { appliances: 1, activeAppliances: 1, activePlans: 1, pendingRequests: 1 };
function source(items) {
  const cursors = [];
  return { cursors, read: async cursor => { cursors.push(cursor); const start = cursor ? items.findIndex(c => c.id === cursor) + 1 : 0; const page = items.slice(start, start + 25); return { items: page, nextCursor: start + 25 < items.length ? page.at(-1).id : null }; } };
}
test("relationship filters do not treat unavailable data as a match", () => {
  assert.equal(projections.matchesFilter({ active: true }, "plans", { ...relationship, activePlans: null }), false);
  assert.equal(projections.matchesFilter({ active: true }, "pending", { ...relationship, pendingRequests: null }), false);
  assert.equal(projections.matchesFilter({ active: false }, "active", relationship), false);
});
test("all-customers view preserves original cursor pagination", async () => {
  const fixture = source(Array.from({ length: 60 }, (_, i) => ({ id: "c" + i, active: true })));
  const page = await projections.filteredDirectory(fixture.read, "all", () => relationship, "c24");
  assert.equal(page.items.length, 25); assert.equal(page.items[0].id, "c25"); assert.equal(page.nextCursor, "c49");
  assert.equal(fixture.cursors.length, 1);
});
test("filters discover matches beyond the first Firestore page", async () => {
  const fixture = source(Array.from({ length: 40 }, (_, i) => ({ id: "c" + i, active: i >= 30 })));
  const page = await projections.filteredDirectory(fixture.read, "active", () => relationship);
  assert.equal(page.items.length, 10); assert.equal(page.items[0].id, "c30"); assert.equal(page.nextCursor, null);
});
test("filtered lookahead keeps all records across page boundaries without duplicates", async () => {
  const items = Array.from({ length: 110 }, (_, i) => ({ id: "c" + i, active: i % 2 === 0 }));
  const fixture = source(items), ids = [];
  let cursor = "";
  do { const page = await projections.filteredDirectory(fixture.read, "active", () => relationship, cursor); ids.push(...page.items.map(c => c.id)); cursor = page.nextCursor; } while (cursor);
  assert.deepEqual(ids, items.filter(c => c.active).map(c => c.id));
});
test("relationship filtering works across source pages", async () => {
  const fixture = source(Array.from({ length: 55 }, (_, i) => ({ id: "c" + i })));
  const page = await projections.filteredDirectory(fixture.read, "pending", id => ({ ...relationship, pendingRequests: id === "c54" ? 1 : 0 }));
  assert.equal(page.items.length, 1); assert.equal(page.items[0].id, "c54"); assert.equal(page.nextCursor, null);
});
test("failed source reads propagate instead of showing an empty directory", async () => {
  await assert.rejects(projections.filteredDirectory(async () => { throw Error("read failed"); }, "active", () => relationship), /read failed/);
});
function serverFixture({ failPlans = false } = {}) {
  let accessed = 0;
  const customerRows = [{ id: "alice", fullName: "Unit A", active: true }, { id: "bob", fullName: "Unit B", active: false }];
  const snapshot = docs => ({ docs, size: docs.length });
  const doc = (path, data) => ({ id: path.split("/").at(-1), ref: { path, parent: { parent: { id: path.split("/")[1] } } }, data: () => data });
  const documents = {
    customers: customerRows.map(c => doc("customers/" + c.id, c)),
    appliances: [doc("customers/alice/appliances/a", { active: true }), doc("customers/alice/appliances/b", { active: true }), doc("customers/bob/appliances/c", { active: false }), doc("other/orphan/appliances/d", { active: true })],
    servicePlans: [doc("customers/alice/appliances/a/servicePlans/p", { startsOn: "2026-01-01", expiresOn: "2026-12-31", totalServices: 2, usedServices: 0 }), doc("customers/bob/appliances/c/servicePlans/p", { startsOn: "2026-01-01", expiresOn: "2026-12-31", totalServices: 2, usedServices: 2 })],
    serviceRequests: [doc("serviceRequests/a", { customerId: "alice" }), doc("serviceRequests/b", { customerId: "alice" })],
  };
  const query = name => ({ select() { return this; }, where() { return this; }, async get() { if (name === "servicePlans" && failPlans) throw Error("offline"); return snapshot(documents[name]); } });
  class AccessError extends Error { constructor(status) { super("Denied"); this.status = status; } }
  const testModule = load("src/lib/admin-customers/server.ts", {
    "server-only": {}, "@/lib/firebase/admin": { adminServices() { accessed++; return { db: { collection: query, collectionGroup: query } }; } },
    "@/lib/customers/server": { CustomerAccessError: AccessError, listCustomers: async () => ({ items: customerRows, nextCursor: null }), getCustomer: async () => null },
    "@/lib/appliances/server": {}, "@/lib/service-plans/server": {}, "@/lib/service-requests/server": {},
    "@/lib/service-plans/data": { indiaDate: () => "2026-11-20", planBalance }, "./projections": projections,
  });
  return { testModule, accessed: () => accessed };
}
for (const role of ["customer", "technician", "superadmin", "systemadmin"]) {
  test(role + " cannot read Admin customer projections before Firestore access", async () => {
    const f = serverFixture();
    await assert.rejects(f.testModule.customerDirectory({ role }, "", "", "all"), e => e.status === 403);
    await assert.rejects(f.testModule.adminCustomerDetails({ role }, "alice"), e => e.status === 403);
    assert.equal(f.accessed(), 0);
  });
}
test("summary metrics count distinct valid customers and preserve per-customer relationships", async () => {
  const { testModule } = serverFixture(), result = await testModule.customerDirectory({ role: "admin" }, "", "", "all");
  assert.equal(result.metrics.total, 2); assert.equal(result.metrics.appliances, 1); assert.equal(result.metrics.plans, 1); assert.equal(result.metrics.pending, 1);
  assert.equal(result.items[0].relationships.appliances, 2); assert.equal(result.items[0].relationships.pendingRequests, 2);
  assert.equal(result.items[1].relationships.activePlans, 0);
});
test("failed relationships stay unavailable and dependent filters fail closed", async () => {
  const { testModule } = serverFixture({ failPlans: true });
  const page = await testModule.customerDirectory({ role: "admin" }, "", "", "all");
  assert.equal(page.metrics.plans, null); assert.equal(page.items[0].relationships.activePlans, null);
  await assert.rejects(testModule.customerDirectory({ role: "admin" }, "", "", "plans"), /unavailable/);
});

