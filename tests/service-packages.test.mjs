import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PackageStoreError } from "../scripts/service-package-store.mjs";
function load(file,dependencies={},globals={}){
  const output=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const testModule={exports:{}};
  runInNewContext(output,{module:testModule,exports:testModule.exports,...globals,require(name){if(!(name in dependencies))throw Error("Unexpected dependency: "+name);return dependencies[name];}});
  return testModule.exports;
}
const data=load("src/lib/service-packages/data.ts",{
  "@/lib/appliances/data":{applianceTypes:{water_purifier:"Water purifier",ac:"Air conditioner"}},
  "@/lib/service-requests/data":{serviceTypes:{installation:"Installation",maintenance:"Maintenance",repair:"Repair"}},
});
const valid={name:"TEST Maintenance",applianceType:"water_purifier",serviceType:"maintenance",price:"499.99",description:"Routine maintenance offering.",active:true};
test("package validation uses exact integer paise and ignores forged audit/price fields",()=>{
  const result=data.validatePackage({...valid,name:"  TEST   Maintenance ",pricePaise:1,createdBy:"victim"});
  assert.equal(result.data.pricePaise,49999);assert.equal(result.data.name,"TEST Maintenance");assert.equal("createdBy" in result.data,false);
  assert.equal(data.validatePackage({...valid,price:"0.01"}).data.pricePaise,1);
  assert.equal(data.validatePackage({...valid,price:"499.1"}).data.pricePaise,49910);
});
for(const [key,value] of [["price","0"],["price","-10"],["price","1.001"],["price","1e3"],["price","Infinity"],["price","1000000.01"],["price",499],["price","1,000"],["name"," "],["description",""],["description","x".repeat(1001)],["applianceType","fridge"],["serviceType","constructor"],["active","true"]]){
  test("package validation rejects invalid "+key+": "+String(value).slice(0,20),()=>assert.equal(data.validatePackage({...valid,[key]:value}).data,null));
}
function fixture(role,detail=false,failure=""){
  const calls=[],server={
    PackageStoreError,
    listServicePackages:async(...args)=>{calls.push(["list",...args]);return {items:[],nextCursor:null};},
    getServicePackage:async(...args)=>{calls.push(["get",...args]);return null;},
    persistServicePackage:async(...args)=>{calls.push(["save",...args]);if(failure)throw new PackageStoreError(failure);return "package";},
  };
  const json={NextResponse:{json:(body,init)=>Response.json(body,init)}};
  class CustomerAccessError extends Error {}
  const http=load("src/lib/service-packages/http.ts",{"server-only":{},"next/server":json,"./server":server,"@/lib/customers/server":{CustomerAccessError}});
  const route=load("src/app/api/service-packages/"+(detail?"[id]/":"")+"route.ts",{
    "next/server":json,"@/lib/auth":{currentProfile:async()=>role?{uid:"session-user",role}:null},
    "@/lib/request-security":{sameOrigin:req=>req.headers.get("origin")==="http://localhost:3001"},
    "@/lib/customers/http":{customerBody:req=>req.json()},"@/lib/service-packages/data":data,
    "@/lib/service-packages/server":server,"@/lib/service-packages/http":http,
  },{URL});
  return {route,calls};
}
const context={params:Promise.resolve({id:"package"})};
function request(method,body=valid,origin="http://localhost:3001"){return new Request("http://localhost:3001/api/service-packages?active=false",{method,headers:{Origin:origin},...(method==="GET"?{}:{body:JSON.stringify(body)})});}
for(const role of [null,"customer","technician"])for(const method of ["POST","PATCH"])test((role||"anonymous")+" cannot "+method+" packages",async()=>{
  const {route,calls}=fixture(role,method==="PATCH");assert.equal((await route[method](request(method),context)).status,role?403:401);assert.equal(calls.length,0);
});
for(const detail of [false,true])test("Technician cannot read package "+(detail?"detail":"list"),async()=>{
  const {route,calls}=fixture("technician",detail);assert.equal((await route.GET(request("GET"),context)).status,403);assert.equal(calls.length,0);
});
test("package writes reject cross-origin requests",async()=>{
  const {route,calls}=fixture("admin");assert.equal((await route.POST(request("POST",valid,"https://evil.invalid"))).status,403);assert.equal(calls.length,0);
});
test("Admin creation persists validated paise using current session identity",async()=>{
  const {route,calls}=fixture("admin");assert.equal((await route.POST(request("POST",{...valid,operatorUid:"victim",createdBy:"victim",pricePaise:1}))).status,201);
  assert.equal(calls[0][1].uid,"session-user");assert.equal(calls[0][2].pricePaise,49999);assert.equal("createdBy" in calls[0][2],false);
});
test("Admin edit carries path ID and expected version, rejecting stale saves",async()=>{
  const {route,calls}=fixture("admin",true,"conflict");
  assert.equal((await route.PATCH(request("PATCH",{...valid,expectedVersion:2,id:"victim"}),context)).status,409);
  assert.equal(calls[0][3],"package");assert.equal(calls[0][4],2);
});
test("package edit requires valid expected version before persistence",async()=>{
  const {route,calls}=fixture("admin",true);assert.equal((await route.PATCH(request("PATCH"),context)).status,400);assert.equal(calls.length,0);
});
test("Customer catalogue passes current session and ignores active=false query input",async()=>{
  const {route,calls}=fixture("customer");assert.equal((await route.GET(request("GET"))).status,200);assert.equal(calls[0][1].role,"customer");assert.equal(calls[0].length,3);
});
test("real package reads filter Customer catalogue, hide inactive details and reject forged inactive cursors",async()=>{
  const calls=[];let active=false;
  const chain={orderBy:()=>chain,where:(...args)=>{calls.push(args);return chain;},limit:()=>chain,startAfter:()=>{throw Error("Inactive cursor used");},get:async()=>({docs:[],size:0}),doc:()=>({get:async()=>({exists:true,id:"record",data:()=>({active})})})};
  const server=load("src/lib/service-packages/server.ts",{
    "server-only":{},"@/lib/firebase/admin":{adminServices:()=>({db:{collection:()=>chain}})},
    "@/lib/service-requests/data":{validId:value=>typeof value==="string"&&/^[a-zA-Z0-9_-]+$/.test(value)},
    "../../../scripts/service-package-store.mjs":{PackageStoreError,saveServicePackage:()=>{}},
  });
  const profile={uid:"customer",role:"customer"};
  await server.listServicePackages(profile);assert.equal(calls[0].join("|"),"active|==|true");
  assert.equal(await server.getServicePackage(profile,"record"),null);
  await assert.rejects(server.listServicePackages(profile,"record"),e=>e.code==="invalid");
  await assert.rejects(server.getServicePackage({uid:"tech",role:"technician"},"record"),e=>e.code==="forbidden");
  active=true;assert.equal((await server.getServicePackage(profile,"record")).active,true);
});
