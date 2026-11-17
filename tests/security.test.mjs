import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const origin = "http://localhost:3107";
let server;
before(async () => {
  const env = { ...process.env, APP_ORIGIN: origin };
  // This suite must never connect to a real Firebase project.
  for (const key of Object.keys(env)) if (key.startsWith("FIREBASE_") || key.startsWith("NEXT_PUBLIC_FIREBASE_")) env[key] = "";
  for (const key of ["FIREBASE_PROJECT_ID","FIREBASE_CLIENT_EMAIL","FIREBASE_PRIVATE_KEY","NEXT_PUBLIC_FIREBASE_API_KEY","NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN","NEXT_PUBLIC_FIREBASE_PROJECT_ID","NEXT_PUBLIC_FIREBASE_APP_ID"]) env[key] = "";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3107"], { env, stdio: "ignore" });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Test server exited early.");
    try { if ((await fetch(origin + "/login")).ok) return; } catch {}
    await delay(500);
  }
  throw new Error("Test server did not become ready.");
});
after(() => server?.kill());
test("login renders sign-in and never offers role selection", async () => {
  const response = await fetch(origin + "/login");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Welcome back/);
  assert.match(html, /Forgot password/);
  assert.doesNotMatch(html, /<select/);
});
async function assertProtectedRedirect(response) {
  const html = await response.text();
  if (response.status === 307) assert.equal(response.headers.get("location"), "/login");
  else {
    assert.equal(response.status, 200);
    assert.match(html, /<meta id="__next-page-redirect" http-equiv="refresh" content="[0-9]+;url=\/login"\/>/);
  }
  assert.doesNotMatch(html, /aria-label="Main navigation"/);
  assert.doesNotMatch(html, /Foundation ready/);
}
for (const role of ["admin", "technician", "customer"]) {
  test(role + " denies missing sessions", async () => {
    const response = await fetch(origin + "/" + role, { redirect: "manual" });
    await assertProtectedRedirect(response);
  });
  test(role + " denies forged cookies and client roles", async () => {
    const response = await fetch(origin + "/" + role, { redirect: "manual", headers: { Cookie: "itech_session=forged; role=admin" } });
    await assertProtectedRedirect(response);
  });
}
test("session creation rejects cross-origin requests before Firebase access", async () => {
  const response = await fetch(origin + "/api/session", { method: "POST", headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" }, body: JSON.stringify({ idToken: "forged" }) });
  assert.equal(response.status, 403);
});
test("session creation rejects missing Origin", async () => {
  const response = await fetch(origin + "/api/session", { method: "POST" });
  assert.equal(response.status, 403);
});
test("session creation rejects malformed token shapes", async () => {
  const response = await fetch(origin + "/api/session", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ idToken: 42, role: "admin" }) });
  assert.equal(response.status, 400);
});
test("session creation fails closed without server configuration", async () => {
  const response = await fetch(origin + "/api/session", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ idToken: "forged" }) });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
});
test("logout rejects cross-origin requests", async () => {
  const response = await fetch(origin + "/api/session", { method: "DELETE", headers: { Origin: "https://untrusted.example" } });
  assert.equal(response.status, 403);
});
test("logout clears even a forged cookie", async () => {
  const response = await fetch(origin + "/api/session", { method: "DELETE", headers: { Origin: origin, Cookie: "itech_session=forged" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /itech_session=;/);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
});

for (const [description, body] of [
  ["null JSON", "null"],
  ["empty token", JSON.stringify({ idToken: "" })],
  ["array JSON", "[]"],
  ["invalid JSON", "{"],
  ["oversized token", JSON.stringify({ idToken: "x".repeat(10001) })],
]) {
  test("session creation returns 400 for " + description, async () => {
    const response = await fetch(origin + "/api/session", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body,
    });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("set-cookie"), null);
  });
}

test("account creation page denies unauthenticated requests", async () => {
  const response = await fetch(origin + "/admin/accounts/new", { redirect: "manual" });
  await assertProtectedRedirect(response);
});
test("account provisioning API denies unauthenticated requests", async () => {
  const response = await fetch(origin + "/api/admin/accounts", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: "synthetic@example.invalid", displayName: "Synthetic", role: "technician" }) });
  assert.equal(response.status, 401);
});
test("account provisioning API rejects cross-origin requests", async () => {
  const response = await fetch(origin + "/api/admin/accounts", { method: "POST", headers: { Origin: "https://untrusted.example" } });
  assert.equal(response.status, 403);
});

for (const path of ["/admin/customers", "/admin/customers/new", "/admin/customers/synthetic", "/admin/customers/synthetic/edit", "/customer/profile"]) {
  test("customer page denies missing session: " + path, async () => {
    await assertProtectedRedirect(await fetch(origin + path, { redirect: "manual" }));
  });
}
for (const path of ["/api/customers", "/api/customers/synthetic", "/api/customer/profile"]) {
  test("customer API denies missing session: " + path, async () => { assert.equal((await fetch(origin + path)).status, 401); });
}
for (const [method, path] of [["POST", "/api/customers"], ["PATCH", "/api/customers/synthetic"]]) {
  test("customer write denies unauthenticated and cross-origin access: " + method, async () => {
    assert.equal((await fetch(origin + path, { method, headers: { Origin: origin }, body: "{}" })).status, 401);
    assert.equal((await fetch(origin + path, { method, headers: { Origin: "https://untrusted.example" }, body: "{}" })).status, 403);
  });
}

for (const path of [
  "/admin/customers/synthetic/appliances", "/admin/customers/synthetic/appliances/new",
  "/admin/customers/synthetic/appliances/record", "/admin/customers/synthetic/appliances/record/edit",
  "/customer/appliances", "/customer/appliances/record",
]) {
  test("appliance page denies missing session: " + path, async () => {
    await assertProtectedRedirect(await fetch(origin + path, { redirect: "manual" }));
  });
}
for (const path of ["/api/customers/synthetic/appliances", "/api/customers/synthetic/appliances/record", "/api/customer/appliances"]) {
  test("appliance API denies missing session: " + path, async () => { assert.equal((await fetch(origin + path)).status, 401); });
}
for (const [method, path] of [["POST", "/api/customers/synthetic/appliances"], ["PATCH", "/api/customers/synthetic/appliances/record"]]) {
  test("appliance write rejects unauthenticated and cross-origin requests: " + method, async () => {
    assert.equal((await fetch(origin + path, { method, headers: { Origin: origin }, body: "{}" })).status, 401);
    assert.equal((await fetch(origin + path, { method, headers: { Origin: "https://untrusted.example" }, body: "{}" })).status, 403);
  });
}

for (const path of ["/admin/service-requests","/admin/service-requests/new","/admin/service-requests/synthetic","/customer/service-requests","/customer/service-requests/new","/customer/service-requests/synthetic"]) {
  test("service request page denies missing session: "+path,async()=>await assertProtectedRedirect(await fetch(origin+path,{redirect:"manual"})));
}
for(const path of ["/api/service-requests","/api/service-requests/synthetic"]) {
  test("service request API denies missing session: "+path,async()=>assert.equal((await fetch(origin+path)).status,401));
}
for(const [method,path] of [["POST","/api/service-requests"],["PATCH","/api/service-requests/synthetic"]]) {
  test("service request "+method+" rejects unauthenticated and cross-origin access",async()=>{
    assert.equal((await fetch(origin+path,{method,headers:{Origin:origin},body:"{}"})).status,401);
    assert.equal((await fetch(origin+path,{method,headers:{Origin:"https://untrusted.example"},body:"{}"})).status,403);
  });
}

for (const path of ["/technician/assignments", "/technician/assignments/synthetic"]) {
  test("assignment page denies missing session: "+path, async()=>await assertProtectedRedirect(await fetch(origin+path,{redirect:"manual"})));
}
for (const path of ["/api/admin/technicians", "/api/technician/assignments", "/api/technician/assignments/synthetic"]) {
  test("assignment API denies missing session: "+path, async()=>assert.equal((await fetch(origin+path)).status,401));
}
test("assignment write rejects unauthenticated and cross-origin requests",async()=>{
  const path=origin+"/api/service-requests/synthetic/assignment";
  assert.equal((await fetch(path,{method:"PATCH",headers:{Origin:origin},body:"{}"})).status,401);
  assert.equal((await fetch(path,{method:"PATCH",headers:{Origin:"https://evil.invalid"},body:"{}"})).status,403);
});

test("technician work endpoint denies missing session and cross-origin writes",async()=>{
  const url=origin+"/api/technician/assignments/synthetic/work";
  assert.equal((await fetch(url,{method:"PATCH",headers:{Origin:origin},body:"{}"})).status,401);
  assert.equal((await fetch(url,{method:"PATCH",headers:{Origin:"https://evil.invalid"},body:"{}"})).status,403);
});

for(const path of ["/admin/service-packages","/admin/service-packages/new","/admin/service-packages/synthetic/edit","/customer/service-packages"]){
  test("package page denies missing session: "+path,async()=>await assertProtectedRedirect(await fetch(origin+path,{redirect:"manual"})));
}
for(const path of ["/api/service-packages","/api/service-packages/synthetic"]){
  test("package API denies missing session: "+path,async()=>assert.equal((await fetch(origin+path)).status,401));
}
for(const [method,path]of [["POST","/api/service-packages"],["PATCH","/api/service-packages/synthetic"]]){
  test("package "+method+" rejects missing session and cross-origin input",async()=>{
    assert.equal((await fetch(origin+path,{method,headers:{Origin:origin},body:"{}"})).status,401);
    assert.equal((await fetch(origin+path,{method,headers:{Origin:"https://evil.invalid"},body:"{}"})).status,403);
  });
}

test("appliance plan creation page denies missing session",async()=>await assertProtectedRedirect(await fetch(origin+"/admin/customers/synthetic/appliances/record/service-plans/new",{redirect:"manual"})));
test("appliance plan API denies missing session and cross-origin writes",async()=>{
  const url=origin+"/api/customers/synthetic/appliances/record/service-plans";
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{method:"POST",headers:{Origin:origin},body:"{}"})).status,401);
  assert.equal((await fetch(url,{method:"POST",headers:{Origin:"https://evil.invalid"},body:"{}"})).status,403);
});

test("Customer own-plan page denies missing session",async()=>await assertProtectedRedirect(await fetch(origin+"/customer/service-plans",{redirect:"manual"})));

for (const path of ["/admin/lifecycle","/customer/lifecycle"]) test(path+" requires a verified session",async()=>{
  await assertProtectedRedirect(await fetch(origin+path,{redirect:"manual"}));
});
for (const path of ["/api/lifecycle?view=renewals","/api/lifecycle/report?view=renewals"]) test(path+" denies anonymous access",async()=>{
  assert.equal((await fetch(origin+path)).status,401);
});
test("new job and webhook endpoints deny unauthenticated invocation",async()=>{
  assert.equal((await fetch(origin+"/api/jobs/service-lifecycle",{method:"POST"})).status,401);
  assert.equal((await fetch(origin+"/api/whatsapp/webhook",{method:"POST",body:"{}"})).status,403);
});
