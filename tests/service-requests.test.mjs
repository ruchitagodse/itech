import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { ServiceRequestError } from "../scripts/service-request-store.mjs";
function load(file, dependencies = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, { module: testModule, exports: testModule.exports, ...globals, require(name) {
    if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name); return dependencies[name];
  } }, { filename: file });
  return testModule.exports;
}
const data = load("src/lib/service-requests/data.ts");
const valid = { customerId: "parent", applianceId: "appliance", serviceType: "repair", description: "Water is leaking from the unit." };
test("request validation trims description and strips forged status/identity/labels", () => {
  const result = data.validateServiceRequest({ ...valid, description: "  Water is leaking.  ", status: "completed", createdBy: "victim", customerName: "forged" });
  assert.equal(result.data.description, "Water is leaking.");
  for (const key of ["status", "createdBy", "customerName"]) assert.equal(key in result.data, false);
});
for (const [key, value] of [["customerId","../victim"],["applianceId",""],["serviceType","amc"],["serviceType","constructor"],["description","short"],["description","x".repeat(2001)],["description",123]]) {
  test("request validation rejects " + key + ": " + String(value).slice(0,20), () => assert.equal(data.validateServiceRequest({ ...valid, [key]:value }).data,null));
}
for (const serviceType of ["installation", "maintenance", "repair"]) test(serviceType + " request accepted", () => assert.ok(data.validateServiceRequest({ ...valid, serviceType }).data));
test("terminal statuses have no next status and invalid prototype names are rejected", () => {
  assert.equal(data.nextStatuses("completed").length,0); assert.equal(data.nextStatuses("cancelled").length,0);
  assert.equal(data.isStatus("constructor"),false);
});
function fixture(role, detail = false, failure = "") {
  const calls = [];
  const server = {
    ServiceRequestError,
    listServiceRequests: async (...args) => { calls.push(["list",...args]); return { items: [], nextCursor: null }; },
    getServiceRequest: async (...args) => { calls.push(["get",...args]); if(failure) throw new ServiceRequestError(failure); return { id:"request" }; },
    submitServiceRequest: async (...args) => { calls.push(["create",...args]); if(failure) throw new ServiceRequestError(failure); return "request"; },
    changeRequestStatus: async (...args) => { calls.push(["update",...args]); if(failure) throw new ServiceRequestError(failure); },
  };
  const json = { NextResponse: { json: (value,init) => Response.json(value,init) } };
  class CustomerAccessError extends Error {}
  const http = load("src/lib/service-requests/http.ts", { "server-only": {}, "next/server": json, "./server": server, "@/lib/customers/server": { CustomerAccessError } });
  const route = load("src/app/api/service-requests/" + (detail ? "[id]/" : "") + "route.ts", {
    "next/server": json, "@/lib/auth": { currentProfile: async () => role ? { uid:"session-uid",role } : null },
    "@/lib/request-security": { sameOrigin: request => request.headers.get("origin") === "http://localhost:3001" },
    "@/lib/customers/http": { customerBody: request => request.json() },
    "@/lib/service-requests/data": data, "@/lib/service-requests/server": server, "@/lib/service-requests/http": http,
  }, { URL });
  return { route,calls };
}
const context = { params: Promise.resolve({ id:"request" }) };
function request(method, body=valid, origin="http://localhost:3001") {
  return new Request("http://localhost:3001/api/service-requests", { method,headers:{ Origin:origin },...(method==="GET"?{}:{ body:JSON.stringify(body) }) });
}
for (const role of [null,"technician"]) {
  for (const [method,detail] of [["GET",false],["GET",true],["POST",false],["PATCH",true]]) {
    test((role||"anonymous") + " denied " + method + " " + detail, async () => {
      const {route,calls}=fixture(role,detail);
      assert.equal((await route[method](request(method),context)).status,role?403:401); assert.equal(calls.length,0);
    });
  }
}
for(const role of ["customer","technician"]) test(role+" cannot update status",async()=>{
  const {route,calls}=fixture(role,true);assert.equal((await route.PATCH(request("PATCH",{status:"completed",expectedStatus:"in_progress"}),context)).status,403);assert.equal(calls.length,0);
});
for(const [method,detail] of [["POST",false],["PATCH",true]]) test("cross-origin "+method+" rejected",async()=>{
  const {route,calls}=fixture("admin",detail);assert.equal((await route[method](request(method,valid,"https://evil.invalid"),context)).status,403);assert.equal(calls.length,0);
});
for(const role of ["admin","customer"]) test(role+" submits using current session and validated fields",async()=>{
  const {route,calls}=fixture(role);
  assert.equal((await route.POST(request("POST",{...valid,operatorUid:"forged",status:"completed"}))).status,201);
  assert.equal(calls[0][1].uid,"session-uid");assert.equal("operatorUid" in calls[0][2],false);assert.equal("status" in calls[0][2],false);
});
for(const [code,status] of [["duplicate",409],["inactive",409],["forbidden",403],["not-found",404]]) test("create error maps "+code,async()=>{
  const {route}=fixture("customer",false,code);assert.equal((await route.POST(request("POST"))).status,status);
});
test("invalid descriptions fail before persistence",async()=>{
  const {route,calls}=fixture("customer");assert.equal((await route.POST(request("POST",{...valid,description:"x"}))).status,400);assert.equal(calls.length,0);
});
test("Admin status update uses path ID/session and expected prior status",async()=>{
  const {route,calls}=fixture("admin",true);
  assert.equal((await route.PATCH(request("PATCH",{status:"in_progress",expectedStatus:"pending",id:"victim",operatorUid:"victim"}),context)).status,200);
  assert.equal(calls[0][1].uid,"session-uid");assert.equal(calls[0][2],"request");assert.equal(calls[0][3],"in_progress");assert.equal(calls[0][4],"pending");
});
test("stale Admin update returns conflict",async()=>{
  const {route}=fixture("admin",true,"conflict");assert.equal((await route.PATCH(request("PATCH",{status:"in_progress",expectedStatus:"pending"}),context)).status,409);
});
test("Customer list ignores forged customer query and uses session",async()=>{
  const {route,calls}=fixture("customer");await route.GET(new Request("http://localhost:3001/api/service-requests?customerId=victim"));assert.equal(calls[0][1].uid,"session-uid");assert.equal(calls[0].length,4);
});
test("real request detail service checks parent ownership before returning a record",async()=>{
  const server=load("src/lib/service-requests/server.ts",{
    "server-only":{}, "@/lib/firebase/admin": {adminServices:()=>({db:{collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>({customerId:"victim"})})})})}})},
    "@/lib/customers/server":{getCustomer:async()=>{throw new Error("Parent denied");},ownCustomer:async()=>null},
    "@/lib/appliances/server":{getAppliance:async()=>null},
    "../../../scripts/service-request-store.mjs":{ServiceRequestError,createServiceRequest:()=>{},updateServiceRequestStatus:()=>{}},
    "./data":data,
  });
  await assert.rejects(server.getServiceRequest({uid:"attacker",role:"customer"},"request"),/Parent denied/);
  await assert.rejects(server.listServiceRequests({uid:"tech",role:"technician"}),e=>e.code==="forbidden");
});

test("real Customer list scopes storage to their linked customer and validates cursor ownership",async()=>{
  const calls=[];
  const chain={where:(...args)=>{calls.push(["where",...args]);return chain;},orderBy:(...args)=>{calls.push(["order",...args]);return chain;},startAfter:()=>{calls.push(["cursor"]);return chain;},limit:value=>{calls.push(["limit",value]);return chain;},get:async()=>({docs:[],size:0}),doc:()=>({get:async()=>({exists:true,data:()=>({customerId:"victim",status:"pending"})})})};
  let linked=true;
  const server=load("src/lib/service-requests/server.ts",{
    "server-only":{},"@/lib/firebase/admin":{adminServices:()=>({db:{collection:()=>chain}})},
    "@/lib/customers/server":{ownCustomer:async()=>linked?{id:"own-parent"}:null,getCustomer:async()=>null},
    "@/lib/appliances/server":{getAppliance:async()=>null},
    "../../../scripts/service-request-store.mjs":{ServiceRequestError,createServiceRequest:()=>{},updateServiceRequestStatus:()=>{}},"./data":data,
  });
  const profile={uid:"current-user",role:"customer"};
  await server.listServiceRequests(profile,"pending");
  assert.ok(calls.some(call=>call.join("|")==="where|customerId|==|own-parent"));
  assert.ok(calls.some(call=>call.join("|")==="where|status|==|pending"));
  assert.ok(calls.some(call=>call.join("|")==="limit|26"));
  calls.length=0;
  await assert.rejects(server.listServiceRequests(profile,"pending","other-record"),e=>e.code==="invalid");
  assert.equal(calls.some(call=>call[0]==="cursor"),false);assert.equal(calls.some(call=>call[0]==="limit"),false);
  calls.length=0;linked=false;
  assert.equal((await server.listServiceRequests(profile)).items.length,0);assert.equal(calls.length,0);
});

for (const notes of [undefined, "", "   ", "x".repeat(2001)]) test("Admin completion API rejects missing or invalid notes: " + String(notes).slice(0,10), async () => {
  const {route,calls}=fixture("admin",true);
  assert.equal((await route.PATCH(request("PATCH",{status:"completed",expectedStatus:"in_progress",notes}),context)).status,400);
  assert.equal(calls.length,0);
});
test("Admin completion API forwards notes with trusted session and path ID",async()=>{
  const {route,calls}=fixture("admin",true);
  assert.equal((await route.PATCH(request("PATCH",{status:"completed",expectedStatus:"in_progress",notes:"Verified service work.",visitId:"forged"}),context)).status,200);
  assert.equal(calls[0][1].uid,"session-uid");assert.equal(calls[0][2],"request");assert.equal(calls[0][5],"Verified service work.");
});
