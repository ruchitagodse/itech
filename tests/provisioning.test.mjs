import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { randomBytes } from "node:crypto";
import ts from "typescript";

function load(filename, dependencies, globals = {}) {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, { module: testModule, exports: testModule.exports, ...globals,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected test dependency: " + name);
      return dependencies[name];
    },
  }, { filename });
  return testModule.exports;
}
function helperFixture(options = {}) {
  const calls = { created: [], deleted: [], profiles: [], fetches: 0 };
  const services = {
    db: {},
    auth: {
      app: { options: { credential: { getAccessToken: async () => ({ access_token: "synthetic-token" }) } } },
      async createUser(input) {
        calls.created.push(input);
        if (options.duplicate) throw { code: "auth/email-already-exists" };
        return { uid: "new-synthetic-user" };
      },
      async deleteUser(uid) { calls.deleted.push(uid); },
    },
  };
  const helper = load("src/lib/provision-account.ts", {
    "server-only": {}, "node:crypto": { randomBytes },
    "@/lib/firebase/admin": { adminServices: () => services },
    "../../scripts/provisioning-store.mjs": { createProfile: async (db, input) => {
      calls.profiles.push(input);
      if (options.profileFailure) throw new Error("Synthetic transaction failure");
    } },
  }, {
    process: { env: { FIREBASE_PROJECT_ID: "demo-unit-tests" } },
    AbortSignal,
    fetch: async () => {
      calls.fetches++;
      if (options.configFailure) throw new Error("Synthetic configuration failure");
      return Response.json({ client: { permissions: { disabledUserSignup: !options.publicSignup } } });
    },
    console: { error() {} },
  });
  return { helper, calls };
}
const valid = { email: "test@example.invalid", displayName: "Test User", role: "technician" };
for (const role of ["technician", "customer"]) {
  test(role + " input is accepted and trimmed", () => {
    const { helper } = helperFixture();
    const parsed = helper.parseAccountInput({ email: " test@example.invalid ", displayName: " Test User ", role });
    assert.equal(parsed.email, "test@example.invalid");
    assert.equal(parsed.displayName, "Test User");
    assert.equal(parsed.role, role);
  });
}
for (const [label, input] of [
  ["Admin role", { ...valid, role: "admin" }],
  ["unknown role", { ...valid, role: "owner" }],
  ["missing name", { ...valid, displayName: " " }],
  ["invalid email", { ...valid, email: "invalid" }],
  ["email containing whitespace", { ...valid, email: "test user@example.invalid" }],
  ["missing email domain separator", { ...valid, email: "test@example" }],
  ["oversized name", { ...valid, displayName: "x".repeat(101) }],
  ["null input", null],
]) {
  test("validation rejects " + label, () => {
    assert.equal(helperFixture().helper.parseAccountInput(input), null);
  });
}
test("provisioning stores the authenticated operator and never returns a password", async () => {
  const { helper, calls } = helperFixture();
  const account = await helper.provisionAccount(valid, "trusted-admin");
  assert.equal(account.uid, "new-synthetic-user");
  assert.equal("password" in account, false);
  assert.equal(calls.created[0].emailVerified, false);
  assert.equal(typeof calls.created[0].password, "string");
  assert.equal(calls.profiles[0].operatorUid, "trusted-admin");
  assert.equal(calls.profiles[0].bootstrap, false);
  assert.equal(calls.profiles[0].role, "technician");
});
test("public signup enabled prevents account creation", async () => {
  const { helper, calls } = helperFixture({ publicSignup: true });
  await assert.rejects(helper.provisionAccount(valid, "trusted-admin"), error => error.status === 503);
  assert.equal(calls.created.length, 0);
});
test("unavailable signup policy fails closed", async () => {
  const { helper, calls } = helperFixture({ configFailure: true });
  await assert.rejects(helper.provisionAccount(valid, "trusted-admin"), error => error.status === 503);
  assert.equal(calls.created.length, 0);
});
test("duplicate email never deletes or changes the existing user", async () => {
  const { helper, calls } = helperFixture({ duplicate: true });
  await assert.rejects(helper.provisionAccount(valid, "trusted-admin"), error => error.status === 409);
  assert.equal(calls.deleted.length, 0);
  assert.equal(calls.profiles.length, 0);
});
test("profile failure rolls back only the just-created Auth account", async () => {
  const { helper, calls } = helperFixture({ profileFailure: true });
  await assert.rejects(helper.provisionAccount(valid, "trusted-admin"), error => error.status === 503);
  assert.deepEqual(calls.deleted, ["new-synthetic-user"]);
});
function routeFixture(role = "admin") {
  const { helper } = helperFixture();
  const calls = [];
  const route = load("src/app/api/admin/accounts/route.ts", {
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/lib/auth": { currentProfile: async () => role ? { uid: "trusted-admin", role } : null },
    "@/lib/request-security": { sameOrigin: request => request.headers.get("origin") === "http://localhost:3001" },
    "@/lib/provision-account": { ...helper, provisionAccount: async (input, uid) => {
      calls.push({ input, uid }); return { uid: "new-synthetic-user", email: input.email, role: input.role };
    } },
  });
  return { route, calls };
}
function request(body = valid, origin = "http://localhost:3001") {
  return new Request("http://localhost:3001/api/admin/accounts", {
    method: "POST", headers: { Origin: origin }, body: JSON.stringify(body),
  });
}
for (const role of [null, "technician", "customer"]) {
  test("API rejects " + (role || "unauthenticated") + " without provisioning", async () => {
    const { route, calls } = routeFixture(role);
    assert.equal((await route.POST(request())).status, role ? 403 : 401);
    assert.equal(calls.length, 0);
  });
}
test("API rejects cross-origin requests even for an Admin", async () => {
  const { route, calls } = routeFixture();
  assert.equal((await route.POST(request(valid, "https://untrusted.example"))).status, 403);
  assert.equal(calls.length, 0);
});
test("API rejects Admin account creation through this form", async () => {
  const { route, calls } = routeFixture();
  assert.equal((await route.POST(request({ ...valid, role: "admin" }))).status, 400);
  assert.equal(calls.length, 0);
});
test("API ignores a forged operator UID and uses the session Admin", async () => {
  const { route, calls } = routeFixture();
  const response = await route.POST(request({ ...valid, operatorUid: "forged-admin" }));
  assert.equal(response.status, 201);
  assert.equal(calls[0].uid, "trusted-admin");
  assert.equal("operatorUid" in calls[0].input, false);
});
test("API rejects oversized input before provisioning", async () => {
  const { route, calls } = routeFixture();
  assert.equal((await route.POST(request({ ...valid, displayName: "x".repeat(5000) }))).status, 413);
  assert.equal(calls.length, 0);
});
