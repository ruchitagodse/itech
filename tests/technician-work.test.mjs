import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { ServiceRequestError } from "../scripts/service-request-store.mjs";
function load(file,dependencies={}){
  const output=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const testModule={exports:{}};
  runInNewContext(output,{module:testModule,exports:testModule.exports,require(name){if(!(name in dependencies))throw Error("Unexpected dependency: "+name);return dependencies[name];}});
  return testModule.exports;
}
const data=load("src/lib/technician-work/data.ts");
const valid={action:"complete",notes:"Changed filter and checked operation.",expectedStatus:"in_progress",expectedVersion:1};
for(const value of [null,[],{}, {...valid,action:"cancel"}, {...valid,notes:"  "}, {...valid,notes:123}, {...valid,notes:"x".repeat(2001)}, {...valid,expectedStatus:"completed"}, {...valid,expectedVersion:-1}, {...valid,expectedVersion:"1"}]){
  test("work validation rejects "+JSON.stringify(value).slice(0,100),()=>assert.equal(data.validateWork(value),null));
}
test("work validation trims notes and excludes forged identity/status fields",()=>{
  const input=data.validateWork({...valid,notes:"  Repaired.  ",actorUid:"victim",assignedTechnicianUid:"victim",status:"cancelled"});
  assert.equal(input.notes,"Repaired.");assert.equal("actorUid" in input,false);assert.equal("status" in input,false);
  assert.ok(data.validateWork({...valid,action:"start",expectedStatus:"pending",notes:""}));
});
function fixture(role,failure=""){
  const calls=[];
  const json={NextResponse:{json:(body,init)=>Response.json(body,init)}};
  class CustomerAccessError extends Error {}
  const http=load("src/lib/service-requests/http.ts",{"server-only":{},"next/server":json,"./server":{ServiceRequestError},"@/lib/customers/server":{CustomerAccessError}});
  const route=load("src/app/api/technician/assignments/[id]/work/route.ts",{
    "next/server":json,"@/lib/auth":{currentProfile:async()=>role?{uid:"session-tech",role}:null},
    "@/lib/request-security":{sameOrigin:req=>req.headers.get("origin")==="http://localhost:3001"},
    "@/lib/customers/http":{customerBody:req=>req.json()},"@/lib/technician-work/data":data,
    "@/lib/technician-work/server":{persistWork:async(...args)=>{calls.push(args);if(failure)throw new ServiceRequestError(failure);}},
    "@/lib/service-requests/http":http,
  });
  return {route,calls};
}
const context={params:Promise.resolve({id:"assigned-request"})};
const request=(body=valid,origin="http://localhost:3001")=>new Request("http://localhost:3001/api/technician/assignments/assigned-request/work",{method:"PATCH",headers:{Origin:origin},body:JSON.stringify(body)});
for(const role of [null,"admin","customer"])test((role||"anonymous")+" cannot use Technician work endpoint",async()=>{
  const {route,calls}=fixture(role);assert.equal((await route.PATCH(request(),context)).status,role?403:401);assert.equal(calls.length,0);
});
test("work endpoint rejects cross-origin even for Technician",async()=>{
  const {route,calls}=fixture("technician");assert.equal((await route.PATCH(request(valid,"https://evil.invalid"),context)).status,403);assert.equal(calls.length,0);
});
test("work endpoint uses session Technician/path ID and validated input",async()=>{
  const {route,calls}=fixture("technician");
  assert.equal((await route.PATCH(request({...valid,actorUid:"victim",id:"victim"}),context)).status,200);
  assert.equal(calls[0][0].uid,"session-tech");assert.equal(calls[0][1],"assigned-request");assert.equal("actorUid" in calls[0][2],false);
});
test("work endpoint rejects blank completion notes before persistence",async()=>{
  const {route,calls}=fixture("technician");assert.equal((await route.PATCH(request({...valid,notes:""}),context)).status,400);assert.equal(calls.length,0);
});
for(const [error,status] of [["forbidden",403],["conflict",409],["transition",409]])test("work endpoint handles "+error,async()=>{
  const {route}=fixture("technician",error);assert.equal((await route.PATCH(request(),context)).status,status);
});
test("private work reads authorize request ownership before reading note storage",async()=>{
  let touched=false;
  const server=load("src/lib/technician-work/server.ts",{
    "server-only":{},"@/lib/firebase/admin":{adminServices:()=>{touched=true;throw Error();}},
    "@/lib/assignments/server":{getAssignment:async()=>null},
    "@/lib/service-requests/server":{getServiceRequest:async()=>null,ServiceRequestError},
    "../../../scripts/technician-work-store.mjs":{},
  });
  for(const role of ["customer","technician","admin"])await assert.rejects(server.getWork({uid:"other",role},"request"),e=>e.code==="forbidden");
  assert.equal(touched,false);
});
