import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { ServiceRequestError } from "../scripts/service-request-store.mjs";
function load(file, dependencies = {}, globals = {}) {
  const output = ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const testModule={exports:{}};
  runInNewContext(output,{module:testModule,exports:testModule.exports,...globals,require(name){if(!(name in dependencies))throw Error("Unexpected dependency: "+name);return dependencies[name];}},{filename:file});
  return testModule.exports;
}
const requestData=load("src/lib/service-requests/data.ts");
const data=load("src/lib/assignments/data.ts",{"@/lib/service-requests/data":requestData});
for(const input of [null,[],{},{technicianUid:"bad/path",expectedVersion:0},{technicianUid:"",expectedVersion:0},{technicianUid:null,expectedVersion:-1},{technicianUid:null,expectedVersion:0.5},{technicianUid:"tech",expectedVersion:"0"}]) {
  test("assignment validation rejects "+JSON.stringify(input),()=>assert.equal(data.validateAssignment(input),null));
}
test("assignment validation accepts unassignment and strips forged names/audit",()=>{
  const input=data.validateAssignment({technicianUid:null,expectedVersion:0,operatorUid:"victim",assignedTechnicianName:"forged"});
  assert.equal(input.technicianUid,null);assert.equal(input.expectedVersion,0);assert.equal("operatorUid" in input,false);assert.equal("assignedTechnicianName" in input,false);
});
function fixture(role,kind="assignment",failure=""){
  const calls=[];
  const service={
    persistAssignment:async(...args)=>{calls.push(args);if(failure)throw new ServiceRequestError(failure);},
    listTechnicians:async(...args)=>{calls.push(args);return {items:[],nextCursor:null};},
    listAssignments:async(...args)=>{calls.push(args);return {items:[],nextCursor:null};},
    getAssignment:async(...args)=>{calls.push(args);return failure?null:{id:"request"};},
  };
  const json={NextResponse:{json:(body,init)=>Response.json(body,init)}};
  class CustomerAccessError extends Error {}
  const http=load("src/lib/service-requests/http.ts",{"server-only":{},"next/server":json,"./server":{ServiceRequestError},"@/lib/customers/server":{CustomerAccessError}});
  const paths={assignment:"src/app/api/service-requests/[id]/assignment/route.ts",directory:"src/app/api/admin/technicians/route.ts",list:"src/app/api/technician/assignments/route.ts",detail:"src/app/api/technician/assignments/[id]/route.ts"};
  return {calls,route:load(paths[kind],{
    "next/server":json,"@/lib/auth":{currentProfile:async()=>role?{uid:"session-user",role}:null},
    "@/lib/request-security":{sameOrigin:request=>request.headers.get("origin")==="http://localhost:3001"},
    "@/lib/customers/http":{customerBody:request=>request.json()},
    "@/lib/assignments/data":data,"@/lib/assignments/server":service,"@/lib/service-requests/http":http,
  },{URL})};
}
function request(method="GET",body={technicianUid:"tech",expectedVersion:0},origin="http://localhost:3001"){
  return new Request("http://localhost:3001/api/assignments?technicianUid=victim",{method,headers:{Origin:origin},...(method==="GET"?{}:{body:JSON.stringify(body)})});
}
const context={params:Promise.resolve({id:"request"})};
for(const role of [null,"customer","technician"]) for(const kind of ["assignment","directory"]){
  test((role||"anonymous")+" denied Admin "+kind,async()=>{
    const {route,calls}=fixture(role,kind);
    const response=kind==="assignment"?await route.PATCH(request("PATCH"),context):await route.GET(request());
    assert.equal(response.status,role?403:401);assert.equal(calls.length,0);
  });
}
for(const role of [null,"admin","customer"]) for(const kind of ["list","detail"]){
  test((role||"anonymous")+" denied Technician "+kind,async()=>{
    const {route,calls}=fixture(role,kind);assert.equal((await route.GET(request(),context)).status,role?403:401);assert.equal(calls.length,0);
  });
}
test("assignment API rejects cross-origin before persistence",async()=>{
  const {route,calls}=fixture("admin");assert.equal((await route.PATCH(request("PATCH",{},"https://evil.invalid"),context)).status,403);assert.equal(calls.length,0);
});
test("assignment API uses path ID and session Admin, ignoring forged metadata",async()=>{
  const {route,calls}=fixture("admin");
  assert.equal((await route.PATCH(request("PATCH",{technicianUid:"tech",expectedVersion:2,operatorUid:"victim",assignedTechnicianName:"forged",id:"other"}),context)).status,200);
  assert.equal(calls[0][0].uid,"session-user");assert.equal(calls[0][1],"request");assert.equal(calls[0][2].expectedVersion,2);assert.equal("assignedTechnicianName" in calls[0][2],false);
});
test("assignment API rejects invalid input",async()=>{
  const {route,calls}=fixture("admin");assert.equal((await route.PATCH(request("PATCH",{technicianUid:"bad/path",expectedVersion:0}),context)).status,400);assert.equal(calls.length,0);
});
for(const code of ["technician-unavailable","assignment-closed","conflict"])test(code+" is a recoverable conflict",async()=>{
  const {route}=fixture("admin","assignment",code);assert.equal((await route.PATCH(request("PATCH"),context)).status,409);
});
test("Technician APIs use current session rather than supplied technician UID",async()=>{
  for(const kind of ["list","detail"]){const {route,calls}=fixture("technician",kind);assert.equal((await route.GET(request(),context)).status,200);assert.equal(calls[0][0].uid,"session-user");}
});
test("missing or reassigned request returns 404 to Technician",async()=>{
  const {route}=fixture("technician","detail","missing");assert.equal((await route.GET(request(),context)).status,404);
});
function serverFixture(){
  const calls=[];let assigned="other-tech";let active=true;
  const chain={where:(...args)=>{calls.push(["where",...args]);return chain;},orderBy:()=>chain,startAfter:()=>{calls.push(["cursor"]);return chain;},limit:value=>{calls.push(["limit",value]);return chain;},
    get:async()=>({docs:[],size:0}),doc:()=>({get:async()=>({exists:true,id:"request",data:()=>({assignedTechnicianUid:assigned,status:"pending",active})})})};
  const server=load("src/lib/assignments/server.ts",{
    "server-only":{},"firebase-admin/firestore":{FieldPath:{documentId:()=>"__name__"}},
    "@/lib/firebase/admin":{adminServices:()=>({db:{collection:()=>chain},auth:{getUsers:async()=>({users:[]})}})},
    "@/lib/service-requests/server":{ServiceRequestError,serviceRequestRecord:doc=>doc.data()},
    "@/lib/service-requests/data":requestData,
    "../../../scripts/assignment-store.mjs":{assignTechnician:async()=>{}},
  });
  return {server,calls,setAssigned:value=>{assigned=value;},setActive:value=>{active=value;}};
}
test("real assignment server scopes query and rejects another Technician's cursor/detail",async()=>{
  const {server,calls,setAssigned}=serverFixture();const profile={uid:"my-tech",role:"technician"};
  await server.listAssignments(profile,"pending");
  assert.ok(calls.some(call=>call.join("|")==="where|assignedTechnicianUid|==|my-tech"));
  assert.ok(calls.some(call=>call.join("|")==="where|status|==|pending"));
  assert.ok(calls.some(call=>call.join("|")==="limit|26"));
  calls.length=0;
  await assert.rejects(server.listAssignments(profile,"","other-request"),e=>e.code==="invalid");
  assert.equal(calls.some(call=>call[0]==="cursor"),false);
  assert.equal(await server.getAssignment(profile,"request"),null);
  setAssigned("my-tech");assert.equal((await server.getAssignment(profile,"request")).assignedTechnicianUid,"my-tech");
  setAssigned(null);assert.equal(await server.getAssignment(profile,"request"),null);
});
test("real assignment server denies other roles and invalid IDs before data access",async()=>{
  const {server,calls}=serverFixture();
  for(const role of ["admin","customer"]){await assert.rejects(server.listAssignments({uid:"actor",role}),e=>e.code==="forbidden");await assert.rejects(server.getAssignment({uid:"actor",role},"request"),e=>e.code==="forbidden");}
  await assert.rejects(server.getAssignment({uid:"tech",role:"technician"},"../victim"),e=>e.code==="not-found");assert.equal(calls.length,0);
});
test("legacy service requests map to unassigned without migration",()=>{
  const server=load("src/lib/service-requests/server.ts",{
    "server-only":{},"@/lib/firebase/admin":{},"@/lib/customers/server":{},"@/lib/appliances/server":{},
    "../../../scripts/service-request-store.mjs":{ServiceRequestError},"./data":requestData,
  });
  const record=server.serviceRequestRecord({id:"old",data:()=>({})});
  assert.equal(record.assignedTechnicianUid,null);assert.equal(record.assignmentVersion,0);assert.equal(record.assignmentUpdatedAt,"");
});

test("technician directory excludes inactive, disabled, unverified and missing accounts, retaining pagination",async()=>{
  const docs=Array.from({length:26},(_,index)=>({id:"tech-"+String(index).padStart(2,"0"),data:()=>({active:index!==1,displayName:"Technician "+index})}));
  const calls=[];
  const chain={where:(...args)=>{calls.push(["where",...args]);return chain;},orderBy:()=>chain,startAfter:value=>{calls.push(["after",value]);return chain;},limit:value=>{calls.push(["limit",value]);return chain;},get:async()=>({docs,size:26})};
  const service=load("src/lib/assignments/server.ts",{
    "server-only":{},"firebase-admin/firestore":{FieldPath:{documentId:()=>"__name__"}},
    "@/lib/firebase/admin":{adminServices:()=>({db:{collection:()=>chain},auth:{getUsers:async identifiers=>{
      assert.equal(identifiers.some(value=>value.uid==="tech-01"),false);
      return {users:identifiers.filter(value=>value.uid!=="tech-04").map(value=>({uid:value.uid,emailVerified:value.uid!=="tech-02",disabled:value.uid==="tech-03",email:"synthetic@example.invalid"}))};
    }}})},
    "@/lib/service-requests/server":{ServiceRequestError,serviceRequestRecord:()=>{}},
    "@/lib/service-requests/data":requestData,"../../../scripts/assignment-store.mjs":{assignTechnician:()=>{}},
  });
  const result=await service.listTechnicians({role:"admin",uid:"admin"},"previous-page");
  assert.equal(result.nextCursor,"tech-24");assert.equal(result.items.length,21);
  assert.equal(result.items.some(item=>["tech-01","tech-02","tech-03","tech-04","tech-25"].includes(item.uid)),false);
  assert.ok(calls.some(call=>call.join("|")==="where|role|==|technician"));
  assert.ok(calls.some(call=>call.join("|")==="after|previous-page"));
});

test("assignment eligibility UI allows only Pending changes or legacy unassigned recovery",()=>{
  assert.equal(data.canAssignTechnician("pending",null),true);
  assert.equal(data.canAssignTechnician("in_progress",null),true);
  assert.equal(data.canAssignTechnician("in_progress","tech"),false);
  assert.equal(data.canAssignTechnician("completed",null),false);
  assert.equal(data.canAssignTechnician("cancelled",null),false);
});
test("assignment dropdown is populated from server-provided eligible technicians without a load click",()=>{
  const form=load("src/components/service-requests/assignment-form.tsx",{
    react:React,"react/jsx-runtime":JsxRuntime,"next/navigation":{useRouter:()=>({refresh(){}})},
  });
  const markup=renderToStaticMarkup(React.createElement(form.AssignmentForm,{
    item:{id:"request",status:"pending",assignmentVersion:0,assignedTechnicianUid:null},
    initialTechnicians:{items:[{uid:"tech",displayName:"Synthetic Sim",email:"synthetic@example.invalid"}],nextCursor:null},
  }));
  assert.match(markup,/<option value="tech">Synthetic Sim/);assert.doesNotMatch(markup,/>Load technicians</);
  const retry=renderToStaticMarkup(React.createElement(form.AssignmentForm,{
    item:{id:"request",status:"pending",assignmentVersion:0,assignedTechnicianUid:null},initialError:"Could not load technicians.",
  }));
  assert.match(retry,/role="alert"/);assert.match(retry,/>Load technicians</);
});
test("unassigned work does not offer start or complete but can still be cancelled",()=>{
  const form=load("src/components/service-requests/request-status-form.tsx",{
    react:React,"react/jsx-runtime":JsxRuntime,"next/navigation":{useRouter:()=>({refresh(){}})},
    "@/lib/service-requests/data":requestData,
  });
  for(const status of ["pending","in_progress"]){
    const markup=renderToStaticMarkup(React.createElement(form.RequestStatusForm,{id:"request",status,assignedTechnicianUid:null}));
    assert.doesNotMatch(markup,/<option value="in_progress"/);assert.doesNotMatch(markup,/<option value="completed"/);
    assert.match(markup,/<option value="cancelled"/);assert.match(markup,/Assign a technician before starting or completing/);
  }
  const assigned=renderToStaticMarkup(React.createElement(form.RequestStatusForm,{id:"request",status:"pending",assignedTechnicianUid:"tech"}));
  assert.match(assigned,/<option value="in_progress"/);
});
test("Admin request page preloads technicians for Pending and legacy unassigned work and gracefully handles lookup failure",async()=>{
  let lookups=0,status="pending",fail=false,captured;
  const page=load("src/app/admin/service-requests/[id]/page.tsx",{
    "react/jsx-runtime":JsxRuntime,"next/link":{default:({children,...props})=>React.createElement("a",props,children)},
    "next/navigation":{notFound:()=>{throw Error("Not found");}},
    "@/lib/auth":{requireRole:async role=>{assert.equal(role,"admin");return {uid:"admin",role};}},
    "@/lib/service-requests/server":{getServiceRequest:async()=>({id:"request",status,assignedTechnicianUid:null,serviceType:"maintenance"})},
    "@/lib/assignments/server":{listTechnicians:async profile=>{assert.equal(profile.uid,"admin");lookups++;if(fail)throw Error();return {items:[{uid:"tech",displayName:"Synthetic Sim",email:"synthetic@example.invalid"}],nextCursor:null};}},
    "@/lib/assignments/data":data,
    "@/lib/technician-work/server":{getWork:async()=>({notes:"",version:0,updatedAt:""})},
    "@/components/service-requests/work-notes":{WorkNotes:()=>null},
    "@/components/service-requests/request-details":{RequestDetails:props=>{captured=props;return React.createElement("div");}},
    "@/lib/service-requests/data":requestData,
  });
  const props={params:Promise.resolve({id:"request"}),searchParams:Promise.resolve({})};
  renderToStaticMarkup(await page.default(props));assert.equal(captured.initialTechnicians.items[0].uid,"tech");
  status="in_progress";renderToStaticMarkup(await page.default(props));assert.equal(lookups,2);
  fail=true;renderToStaticMarkup(await page.default(props));assert.equal(captured.initialTechnicians,undefined);assert.match(captured.technicianError,/Load technicians/);
  status="completed";renderToStaticMarkup(await page.default(props));assert.equal(lookups,3);
});
