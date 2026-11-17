import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {LifecycleError} from "../scripts/lifecycle-store.mjs";
import {equalSecret,validSignature} from "../scripts/whatsapp-outbox.mjs";
function load(file,deps,env={}){
  const testModule={exports:{}},code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{module:testModule,exports:testModule.exports,URL,Response,process:{env},require(name){if(!(name in deps))throw Error("Unexpected dependency "+name);return deps[name];}});
  return testModule.exports;
}
const json={"next/server":{NextResponse:{json:(body,init)=>Response.json(body,init)}}};
function lifecycle(role,origin=true){
  const calls=[];
  const route=load("src/app/api/lifecycle/route.ts",{...json,
    "@/lib/auth":{currentProfile:async()=>role?{uid:"trusted-session",role}:null},
    "@/lib/request-security":{sameOrigin:()=>origin},"@/lib/customers/http":{customerBody:r=>r.json()},
    "@/lib/lifecycle/server":{LifecycleError,views:["maintenanceSchedule","renewals","serviceFollowups","notifications"],
      lifecyclePage:async(profile)=>{if(profile.role==="technician")throw new LifecycleError("forbidden");return {items:[],nextCursor:null};},
      performLifecycle:async(...args)=>{calls.push(args);return "saved";}}
  });
  return {route,calls};
}
const req=(method="POST",body={action:"consent",enabled:false,phone:""})=>new Request("http://localhost/api/lifecycle?view=renewals",{method,...(method==="POST"?{body:JSON.stringify(body)}:{})});
for(const role of [null,"technician"])test("lifecycle API denies "+(role??"anonymous")+" mutations",async()=>{
  const f=lifecycle(role);assert.equal((await f.route.POST(req())).status,role?403:401);assert.equal(f.calls.length,0);
});
test("lifecycle API rejects cross-origin writes and uses only session identity",async()=>{
  const rejected=lifecycle("admin",false);assert.equal((await rejected.route.POST(req())).status,403);assert.equal(rejected.calls.length,0);
  const f=lifecycle("admin");assert.equal((await f.route.POST(req("POST",{action:"confirm",uid:"forged"}))).status,200);
  assert.equal(f.calls[0][0].uid,"trusted-session");
});
test("lifecycle read API denies missing and Technician sessions",async()=>{
  for(const role of [null,"technician"]){assert.equal((await lifecycle(role).route.GET(req("GET"))).status,role?403:401);}
});
test("scheduler refuses missing, short and wrong secrets without accessing Firebase",async()=>{
  for(const secret of [undefined,"short","x".repeat(32)]){
    let calls=0;
    const route=load("src/app/api/jobs/service-lifecycle/route.ts",{...json,
      "@/lib/firebase/admin":{adminServices:()=>{calls++;throw Error();}},
      "../../../../../scripts/whatsapp-outbox.mjs":{equalSecret},
      "../../../../../scripts/lifecycle-jobs.mjs":{runLifecycleJobs:()=>{throw Error();}}
    },{SERVICE_JOB_SECRET:secret});
    const response=await route.POST(new Request("http://localhost/api/jobs",{method:"POST",headers:{Authorization:"Bearer invalid"}}));
    assert.equal(response.status,401);assert.equal(calls,0);
  }
});
test("scheduler needs an explicitly matching enabled project even with the correct secret",async()=>{
  let calls=0;const secret="x".repeat(32);
  const route=load("src/app/api/jobs/service-lifecycle/route.ts",{...json,"@/lib/firebase/admin":{adminServices:()=>{calls++;throw Error();}},
    "../../../../../scripts/whatsapp-outbox.mjs":{equalSecret},"../../../../../scripts/lifecycle-jobs.mjs":{}
  },{SERVICE_JOB_SECRET:secret,FIREBASE_PROJECT_ID:"synthetic-dev",AUTOMATION_PROJECT_ID:"wrong"});
  assert.equal((await route.POST(new Request("http://localhost/api/jobs",{method:"POST",headers:{Authorization:"Bearer "+secret}}))).status,503);assert.equal(calls,0);
});
test("webhook challenge and delivery receiver fail closed without correct secrets",async()=>{
  let calls=0;
  const route=load("src/app/api/whatsapp/webhook/route.ts",{...json,"@/lib/firebase/admin":{adminServices:()=>{calls++;throw Error();}},
    "../../../../../scripts/whatsapp-outbox.mjs":{equalSecret,validSignature,applyDelivery:async()=>{calls++;}}
  },{WHATSAPP_VERIFY_TOKEN:"synthetic-verify",WHATSAPP_APP_SECRET:"synthetic-secret"});
  assert.equal((await route.GET(new Request("http://localhost/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123"))).status,403);
  assert.equal(await (await route.GET(new Request("http://localhost/webhook?hub.mode=subscribe&hub.verify_token=synthetic-verify&hub.challenge=123"))).text(),"123");
  assert.equal((await route.POST(new Request("http://localhost/webhook",{method:"POST",body:"{}"}))).status,403);assert.equal(calls,0);
});
test("new protected lifecycle pages and APIs are covered by regression smoke checks",()=>{
  const source=readFileSync("tests/security.test.mjs","utf8");
  assert.match(source,/admin\/lifecycle/);assert.match(source,/customer\/lifecycle/);
});
