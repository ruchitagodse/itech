import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as dates from "../scripts/service-plan-dates.mjs";
import { PlanStoreError } from "../scripts/service-plan-store.mjs";
function load(file,dependencies={},globals={}){
  const output=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const testModule={exports:{}};
  runInNewContext(output,{module:testModule,exports:testModule.exports,...globals,require(name){if(!(name in dependencies))throw Error("Unexpected dependency: "+name);return dependencies[name];}});
  return testModule.exports;
}
const validId=value=>typeof value==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const data=load("src/lib/service-plans/data.ts",{"../../../scripts/service-plan-dates.mjs":dates,"@/lib/service-requests/data":{validId}});
const valid={name:"Two free maintenance visits",startsOn:"2026-11-15",expiresOn:"2027-11-15",packageId:null,expectedLatestPlanId:null};
test("plan allowance expires after the inclusive expiry day without treating unused visits as used",()=>{
  const plan={startsOn:valid.startsOn,expiresOn:valid.expiresOn,totalServices:2,usedServices:0};
  assert.equal(dates.planBalance(plan,"2027-11-15").remainingServices,2);
  const expired=dates.planBalance(plan,"2027-11-16");
  assert.equal(expired.remainingServices,0);assert.equal(expired.expiredServices,2);assert.equal(plan.usedServices,0);
  assert.equal(dates.planBalance({...plan,usedServices:2},"2027-11-15").status,"exhausted");
  assert.equal(dates.planBalance(plan,"2026-11-14").status,"upcoming");
});
test("expiry uses Indian midnight and handles leap-year renewal defaults",()=>{
  assert.equal(dates.indiaDate(new Date("2027-11-15T18:29:59.999Z")),"2027-11-15");
  assert.equal(dates.indiaDate(new Date("2027-11-15T18:30:00.000Z")),"2027-11-16");
  assert.equal(data.nextYear("2024-02-29"),"2025-02-28");
  assert.equal(data.nextDay("2027-11-15"),"2027-11-16");
});
for(const change of [{startsOn:"2026-02-30"},{expiresOn:"2026-11-14"},{name:" "},{name:"x".repeat(101)},{packageId:"bad/path"},{expectedLatestPlanId:"bad/path"},{packageId:undefined}]){
  test("plan validation rejects "+JSON.stringify(change),()=>assert.equal(data.validatePlan({...valid,...change}),null));
}
test("plan input ignores supplied allowances, usage, owner and audit fields",()=>{
  const input=data.validatePlan({...valid,totalServices:999,usedServices:-1,ownerUid:"victim",createdBy:"victim"});
  for(const key of ["totalServices","usedServices","ownerUid","createdBy"])assert.equal(key in input,false);
});
function fixture(role,failure=""){
  const calls=[],json={NextResponse:{json:(body,init)=>Response.json(body,init)}};
  class CustomerAccessError extends Error {}
  const http=load("src/lib/service-plans/http.ts",{"server-only":{},"next/server":json,"./server":{PlanStoreError},"@/lib/customers/server":{CustomerAccessError}});
  const route=load("src/app/api/customers/[id]/appliances/[applianceId]/service-plans/route.ts",{
    "next/server":json,"@/lib/auth":{currentProfile:async()=>role?{uid:"session-user",role}:null},
    "@/lib/request-security":{sameOrigin:req=>req.headers.get("origin")==="http://localhost:3001"},
    "@/lib/customers/http":{customerBody:req=>req.json()},"@/lib/service-plans/data":data,
    "@/lib/service-plans/server":{listAppliancePlans:async(...args)=>{calls.push(args);if(failure)throw new PlanStoreError(failure);return {items:[]};},persistPlan:async(...args)=>{calls.push(args);if(failure)throw new PlanStoreError(failure);return "plan";}},
    "@/lib/service-plans/http":http,
  },{URL});
  return {route,calls};
}
const context={params:Promise.resolve({id:"parent",applianceId:"appliance"})};
function request(method,body=valid,origin="http://localhost:3001"){return new Request("http://localhost:3001/api/plans",{method,headers:{Origin:origin},...(method==="GET"?{}:{body:JSON.stringify(body)})});}
for(const role of [null,"customer","technician"])test((role||"anonymous")+" cannot create or renew appliance plans",async()=>{
  const {route,calls}=fixture(role);assert.equal((await route.POST(request("POST"),context)).status,role?403:401);assert.equal(calls.length,0);
});
test("Technician plan reads and cross-origin Admin writes are denied",async()=>{
  const tech=fixture("technician");assert.equal((await tech.route.GET(request("GET"),context)).status,403);
  const admin=fixture("admin");assert.equal((await admin.route.POST(request("POST",valid,"https://evil.invalid"),context)).status,403);assert.equal(admin.calls.length,0);
});
test("Admin plan writes use path parent/appliance and session identity, not client audit fields",async()=>{
  const {route,calls}=fixture("admin");
  assert.equal((await route.POST(request("POST",{...valid,customerId:"victim",operatorUid:"victim",totalServices:999}),context)).status,201);
  assert.equal(calls[0][0].uid,"session-user");assert.equal(calls[0][1],"parent");assert.equal(calls[0][2],"appliance");assert.equal("totalServices" in calls[0][3],false);
});
for(const code of ["overlap","conflict","package-unavailable","inactive"])test("plan conflict maps "+code,async()=>{
  const {route}=fixture("admin",code);assert.equal((await route.POST(request("POST"),context)).status,409);
});
test("Customer other-owner access denial is returned without exposing plans",async()=>{
  const {route}=fixture("customer","forbidden");assert.equal((await route.GET(request("GET"),context)).status,403);
});
test("plan list service authorizes the parent appliance before touching plan storage",async()=>{
  let touched=false;
  const server=load("src/lib/service-plans/server.ts",{
    "server-only":{},"@/lib/firebase/admin":{adminServices:()=>{touched=true;throw Error();}},
    "@/lib/appliances/server":{getAppliance:async()=>{throw Error("Parent denied");}},
    "@/lib/service-requests/data":{validId},
    "../../../scripts/service-plan-store.mjs":{PlanStoreError},
    "./data":data,
  });
  await assert.rejects(server.listAppliancePlans({uid:"other",role:"customer"},"victim","appliance"),/Parent denied/);
  assert.equal(touched,false);
});

test("free-service intent is validated and cannot be applied to a complaint",()=>{
  const requests=load("src/lib/service-requests/data.ts");
  const input={customerId:"parent",applianceId:"appliance",serviceType:"maintenance",description:"TEST: Book included maintenance.",useIncludedVisit:true};
  assert.equal(requests.validateServiceRequest(input).data.useIncludedVisit,true);
  assert.equal(requests.validateServiceRequest({...input,serviceType:"repair"}).data,null);
  assert.equal(requests.validateServiceRequest({...input,useIncludedVisit:"true"}).data,null);
  assert.equal("servicePlanId" in requests.validateServiceRequest({...input,servicePlanId:"victim-plan"}).data,false);
});
test("Customer plan overview scopes all appliance queries to the current linked customer",async()=>{
  const paths=[];let linked=true,lookups=0;
  const chain={where:()=>chain,orderBy:()=>chain,limit:()=>chain,get:async()=>({empty:true,docs:[]})};
  const server=load("src/lib/service-plans/server.ts",{
    "server-only":{},"@/lib/firebase/admin":{adminServices:()=>({db:{doc:path=>{paths.push(path);return{collection:()=>chain};}}})},
    "@/lib/appliances/server":{customerAppliances:async profile=>{lookups++;assert.equal(profile.uid,"current-customer");return {customer:linked?{id:"own-parent"}:null,items:linked?[{id:"own-appliance"}]:[],nextCursor:null};}},
    "@/lib/service-requests/data":{validId},"../../../scripts/service-plan-store.mjs":{PlanStoreError},"./data":data,
  });
  for(const role of ["admin","technician"])await assert.rejects(server.ownPlanOverview({uid:"other",role}),e=>e.code==="forbidden");
  assert.equal(lookups,0);
  const result=await server.ownPlanOverview({uid:"current-customer",role:"customer"});
  assert.equal(result.items.length,1);assert.deepEqual(paths,["customers/own-parent/appliances/own-appliance"]);
  linked=false;paths.length=0;assert.equal((await server.ownPlanOverview({uid:"current-customer",role:"customer"})).items.length,0);assert.equal(paths.length,0);
});
test("Customer My Plans shows own booking/complaint actions and hides free booking after expiry",async()=>{
  let status="active",remaining=2;
  const plansView=load("src/components/customer-plans/customer-plans-view.tsx",{
    "react":React,
    "react/jsx-runtime":JsxRuntime,
    "next/link":{default:({children,...props})=>React.createElement("a",props,children)},
    "@/lib/appliances/data":{applianceTypes:{water_purifier:"Water Purifier",ac:"Air Conditioner"}},
    "@/lib/service-plans/data":{indiaDate:()=>"2026-11-18"},
    "@/components/customer-home/icons":{HomeIcon:()=>null},
    "./plans.module.css":new Proxy({default:new Proxy({},{get:()=>""})},{get:(t,p)=>p in t?t[p]:""}),
  });
  const page=load("src/app/customer/service-plans/page.tsx",{
    "react/jsx-runtime":JsxRuntime,
    "next/link":{default:({children,...props})=>React.createElement("a",props,children)},
    "@/lib/auth":{requireRole:async role=>{assert.equal(role,"customer");return {uid:"owner",role};}},
    "@/lib/service-plans/server":{ownPlanOverview:async()=>({customer:{active:true},nextCursor:null,items:[{appliance:{id:"own-appliance",brand:"TEST",model:"Purifier",active:true},current:{name:"My two visits",status,remainingServices:remaining,totalServices:2,usedServices:0,expiresOn:"2027-11-15"},upcoming:null}]})},
    "@/lib/lifecycle/server":{lifecyclePage:async()=>({items:[]})},
    "@/components/customer-plans/customer-plans-view":plansView,
    "@/components/appliances/appliance-list":{AppliancePagination:()=>null},
  });
  const props={searchParams:Promise.resolve({})};
  const active=renderToStaticMarkup(await page.default(props));
  assert.match(active,/Book free maintenance/);assert.match(active,/serviceType=maintenance&amp;free=1/);assert.match(active,/Report a complaint/);assert.match(active,/My two visits/);
  status="expired";remaining=0;
  const expired=renderToStaticMarkup(await page.default(props));
  assert.doesNotMatch(expired,/Book free maintenance/);assert.match(expired,/Report a complaint/);assert.match(expired,/Expired/);
});
