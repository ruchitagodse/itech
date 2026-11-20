import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function load(file, dependencies = {}) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, { module: testModule, exports: testModule.exports, require(name) { if (!(name in dependencies)) throw Error("Unexpected dependency: " + name); return dependencies[name]; } });
  return testModule.exports;
}
const data = load("src/lib/admin-technicians/data.ts");
test("account status matches the existing assignment eligibility rules", () => {
  assert.equal(data.accountStatus(true, { disabled: false, emailVerified: true }), "active");
  assert.equal(data.accountStatus(true, { disabled: false, emailVerified: false }), "unverified");
  assert.equal(data.accountStatus(true, { disabled: true, emailVerified: true }), "disabled");
  assert.equal(data.accountStatus(false, { disabled: false, emailVerified: true }), "inactive");
});
test("confirmed missing Auth accounts differ from failed Auth reads", () => {
  assert.equal(data.accountStatus(true, null), "missing");
  assert.equal(data.accountStatus(true, undefined), "unavailable");
});
test("workload counts actual attribution and excludes unassigned/cancelled work", () => {
  const result = data.workloadFor([
    { assignedTechnicianUid: "tech", status: "pending" }, { assignedTechnicianUid: "tech", status: "in_progress" },
    { assignedTechnicianUid: "tech", status: "completed" }, { assignedTechnicianUid: "tech", status: "cancelled" },
    { assignedTechnicianUid: null, status: "completed" }, { assignedTechnicianUid: "other", status: "completed" },
  ]);
  assert.equal(result.get("tech").assigned, 2); assert.equal(result.get("tech").inProgress, 1); assert.equal(result.get("tech").pending, 1); assert.equal(result.get("tech").completed, 1);
  assert.equal(result.get("other").completed, 1); assert.equal(result.has(null), false);
});
const person = { id: "tech", displayName: "Unit Technician", email: "unit@example.invalid", phone: "+91 9876543210", status: "active", workload: { assigned: 2, pending: 1, inProgress: 1, completed: 3 } };
test("search supports actual name, email, and recorded phone", () => {
  for (const term of ["TECHNICIAN", "unit@example", "98765", "+91 98765"]) assert.equal(data.matchesTechnician(person, term, "all", "all"), true);
  assert.equal(data.matchesTechnician(person, "no-match", "all", "all"), false);
});
test("status and workload filters compose without invented availability", () => {
  assert.equal(data.matchesTechnician(person, "unit", "active", "progress"), true);
  assert.equal(data.matchesTechnician(person, "", "unverified", "assigned"), false);
  assert.equal(data.matchesTechnician({ ...person, workload: null }, "", "all", "assigned"), false);
});
test("creation validation accepts only the existing name/email fields", () => {
  assert.equal(Object.keys(data.validateTechnicianInput(" Technician ", " unit@example.invalid ")).length, 0);
  assert.ok(data.validateTechnicianInput(" ", "bad").displayName);
  assert.ok(data.validateTechnicianInput("Name", "bad").email);
  assert.ok(data.validateTechnicianInput("x".repeat(101), "unit@example.invalid").displayName);
});
function fixture({ count = 2, authFailure = false, requestFailure = false, targetRole = "technician", missing = false } = {}) {
  let accessed = 0, authCalls = 0; const batchSizes = [];
  const profiles = Array.from({ length: count }, (_, i) => ({ id: "tech" + String(i).padStart(3, "0"), data: () => ({ role: "technician", active: true, displayName: "Unit " + i, email: "profile@example.invalid" }) }));
  const requests = [{ assignedTechnicianUid: "tech000", status: "in_progress" }, { assignedTechnicianUid: "tech000", status: "completed" }];
  const account = uid => ({ uid, email: "auth@example.invalid", phoneNumber: "+919876543210", displayName: "Auth name", disabled: false, emailVerified: true, passwordHash: "DO_NOT_EXPOSE", customClaims: { private: true }, tokensValidAfterTime: "DO_NOT_EXPOSE" });
  function query(name) { return { where() { return this; }, orderBy() { return this; }, select() { return this; }, limit() { return this; }, startAfter() { return this; },
    doc(id) { return { get: async () => ({ id, exists: true, data: () => ({ role: targetRole, active: true, displayName: "Unit", email: "profile@example.invalid" }) }) }; },
    async get() { if (name === "serviceRequests" && requestFailure) throw Error("offline"); const docs = name === "users" ? profiles : requests.map((r, i) => ({ id: "r" + i, data: () => r })); return { docs, size: docs.length }; },
  }; }
  const testModule = load("src/lib/admin-technicians/server.ts", {
    "server-only": {}, "firebase-admin/firestore": { FieldPath: { documentId: () => "documentId" } },
    "@/lib/firebase/admin": { adminServices() { accessed++; return { db: { collection: query }, auth: {
      async getUsers(ids) { authCalls++; batchSizes.push(ids.length); if (authFailure) throw Error("offline"); return { users: missing ? [] : ids.map(i => account(i.uid)) }; },
      async getUser(id) { authCalls++; if (authFailure) throw Error("offline"); if (missing) throw { code: "auth/user-not-found" }; return account(id); },
    } }; } },
    "@/lib/service-requests/server": { serviceRequestRecord: d => ({ id: d.id, ...d.data() }) },
    "@/lib/service-requests/data": { validId: value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value) }, "./data": data,
  });
  return { testModule, accessed: () => accessed, authCalls: () => authCalls, batchSizes };
}
for (const role of ["customer", "technician", "superadmin", "systemadmin"]) {
  test(role + " cannot read workforce data before Admin authorization", async () => {
    const f = fixture();
    await assert.rejects(f.testModule.technicianDirectory({ role }, {}), /Admin access/);
    await assert.rejects(f.testModule.technicianDetails({ role }, "tech000"), /Admin access/);
    assert.equal(f.accessed(), 0);
  });
}
test("directory returns accurate counts and an explicit safe Auth projection", async () => {
  const f = fixture(), result = await f.testModule.technicianDirectory({ role: "admin" }, {});
  assert.equal(result.metrics.total, 2); assert.equal(result.metrics.assigned, 1); assert.equal(result.metrics.inProgress, 1); assert.equal(result.metrics.completed, 1);
  assert.equal(result.items[0].email, "auth@example.invalid");
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_EXPOSE|passwordHash|customClaims|tokensValid/);
});
test("Auth batches respect Firebase's 100-account limit and directory pages remain stable", async () => {
  const f = fixture({ count: 103 }), first = await f.testModule.technicianDirectory({ role: "admin" }, {});
  assert.equal(f.batchSizes[0], 100); assert.equal(f.batchSizes[1], 3); assert.equal(first.items.length, 25); assert.equal(first.nextCursor, "tech024");
  const second = await f.testModule.technicianDirectory({ role: "admin" }, { cursor: first.nextCursor });
  assert.equal(second.items[0].id, "tech025"); assert.equal(second.items.length, 25);
});
test("directory filters the complete dataset before taking 25 rows", async () => {
  const result = await fixture({ count: 103 }).testModule.technicianDirectory({ role: "admin" }, { q: "Unit 102" });
  assert.equal(result.items.length, 1); assert.equal(result.items[0].id, "tech102");
});
test("non-technician detail identifiers never read Auth accounts or expose another role", async () => {
  const f = fixture({ targetRole: "customer" });
  assert.equal(await f.testModule.technicianDetails({ role: "admin" }, "customer000"), null); assert.equal(f.authCalls(), 0);
});
test("missing accounts and failed Auth reads remain distinct on detail pages", async () => {
  const missing = await fixture({ missing: true }).testModule.technicianDetails({ role: "admin" }, "tech000");
  const failed = await fixture({ authFailure: true }).testModule.technicianDetails({ role: "admin" }, "tech000");
  assert.equal(missing.technician.status, "missing"); assert.equal(failed.technician.status, "unavailable");
});
test("failed assignment reads remain unavailable and workload filtering fails closed", async () => {
  const f = fixture({ requestFailure: true }), result = await f.testModule.technicianDirectory({ role: "admin" }, {});
  assert.equal(result.metrics.assigned, null); assert.equal(result.items[0].workload, null);
  await assert.rejects(f.testModule.technicianDirectory({ role: "admin" }, { workload: "assigned" }), /unavailable/);
});
test("invalid identifiers and oversized search fail before data access", async () => {
  const f = fixture();
  await assert.rejects(f.testModule.technicianDirectory({ role: "admin" }, { q: "x".repeat(255) }), /Invalid/);
  await assert.rejects(f.testModule.technicianDetails({ role: "admin" }, "bad/path"), /Invalid/);
  assert.equal(f.accessed(), 0);
});

