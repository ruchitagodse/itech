import {test} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {addMonths,period,serviceDueStatus} from "../scripts/lifecycle-policy.mjs";
import {indiaDate,planBalance} from "../scripts/service-plan-dates.mjs";
import {notificationId,equalSecret,validSignature,nextDelivery} from "../scripts/whatsapp-outbox.mjs";
import {reminderEvents} from "../scripts/lifecycle-jobs.mjs";
test("installation anniversary expiry is package-configured and inclusive in Kolkata",()=>{
  const p=period("2026-11-15",{validityMonths:12,maintenanceIntervalMonths:6});
  assert.equal(p.expiresOn,"2027-11-15");assert.deepEqual(p.dueDates,["2027-05-15","2027-11-15"]);
  assert.equal(planBalance(p,indiaDate(new Date("2027-11-15T18:29:59.999Z"))).remainingServices,2);
  assert.equal(planBalance(p,indiaDate(new Date("2027-11-15T18:30:00Z"))).remainingServices,0);
});
test("calendar month arithmetic clamps leap days and month ends",()=>{
  assert.equal(addMonths("2024-02-29",12),"2025-02-28");assert.equal(addMonths("2026-08-31",6),"2027-02-28");
  assert.throws(()=>addMonths("2026-02-30",6));assert.throws(()=>period("2026-01-01",{}));
});
test("short packages reject incompatible frequency without collapsing due dates",()=>{
  for (const validityMonths of [1,3,6,11]) assert.throws(()=>period("2026-11-15",{validityMonths,maintenanceIntervalMonths:6}),e=>e.code==="schedule-conflict");
  const p=period("2026-11-15",{validityMonths:2,maintenanceIntervalMonths:1});
  assert.deepEqual(p.dueDates,["2026-12-15","2027-01-15"]);assert.equal(new Set(p.dueDates).size,2);
});
test("overdue is derived independently of unused expiry and completed status",()=>{
  const row={status:"due",dueOn:"2027-05-15",expiresOn:"2027-11-15"};
  assert.equal(serviceDueStatus(row,"2027-05-14"),"upcoming");assert.equal(serviceDueStatus(row,"2027-05-15"),"due");
  assert.equal(serviceDueStatus(row,"2027-05-16"),"overdue");assert.equal(serviceDueStatus(row,"2027-11-16"),"expired");
  assert.equal(serviceDueStatus({...row,status:"completed"},"2027-11-16"),"completed");
});
test("notification IDs distinguish recipient, event and renewal period; retries use the same ID",()=>{
  const one=notificationId("maintenance","plan-a_1","customer");
  assert.equal(one,notificationId("maintenance","plan-a_1","customer"));
  for(const parts of [["maintenance","plan-a_1","admin"],["maintenance","plan-b_1","customer"],["expiry","plan-a_1","customer"]])
    assert.notEqual(one,notificationId(...parts));
});
test("signed webhook validation rejects tampering, missing secrets and mismatched signatures",()=>{
  const raw='{"object":"whatsapp_business_account"}',secret="synthetic-secret";
  const signature="sha256="+createHmac("sha256",secret).update(raw).digest("hex");
  assert.equal(validSignature(raw,signature,secret),true);assert.equal(validSignature(raw+" ",signature,secret),false);
  assert.equal(validSignature(raw,signature,undefined),false);assert.equal(equalSecret("",""),false);assert.equal(equalSecret(null,"secret"),false);
});
test("provider acceptance never means delivery; out-of-order callbacks cannot undo delivery",()=>{
  assert.equal(nextDelivery("accepted","sent"),"sent");assert.equal(nextDelivery("accepted","delivered"),"delivered");
  assert.equal(nextDelivery("delivered","sent"),"delivered");assert.equal(nextDelivery("read","failed"),"read");
  assert.equal(nextDelivery("failed","delivered"),"delivered");
});
const settings={maintenanceLeadDays:7,expiryLeadDays:30,overdueRepeatDays:14};
const scheduled={customerId:"c",planId:"p",planName:"Care",visit:1,status:"due",dueOn:"2027-05-15",expiresOn:"2027-11-15"};
test("reminder interval comes from configuration and does not invent a service request",()=>{
  assert.equal(reminderEvents("maintenanceSchedule","v",scheduled,settings,"2027-05-07").length,0);
  const events=reminderEvents("maintenanceSchedule","v",scheduled,settings,"2027-05-08");
  assert.equal(events.length,1);assert.equal(events[0].kind,"maintenance");assert.equal("appointmentAt" in events[0],false);
});
test("overdue reminders repeat only in configured deterministic buckets",()=>{
  const a=reminderEvents("maintenanceSchedule","v",scheduled,settings,"2027-05-16")[0];
  const b=reminderEvents("maintenanceSchedule","v",scheduled,settings,"2027-05-20")[0];
  const c=reminderEvents("maintenanceSchedule","v",scheduled,settings,"2027-05-29")[0];
  assert.equal(a.sourceKey,b.sourceKey);assert.notEqual(a.sourceKey,c.sourceKey);
});
test("each expiry milestone is independent, deduplicated per plan and includes the expiry day",()=>{
  const rows=[1,2].flatMap(visit=>reminderEvents("maintenanceSchedule","v"+visit,{...scheduled,visit,status:"completed"},settings,"2027-11-15"));
  assert.equal(rows.filter(e=>e.kind==="expiry").length,2);
  assert.deepEqual(reminderEvents("maintenanceSchedule","v",scheduled,settings,"2027-11-16"),[]);
});
test("closed followups never notify and open followups are Admin-only",()=>{
  assert.deepEqual(reminderEvents("serviceFollowups","r",{customerId:"c",closed:true,dueOn:"2027-05-15"},settings,"2027-05-16"),[]);
  assert.equal(reminderEvents("serviceFollowups","r",{customerId:"c",closed:false,dueOn:"2027-05-15"},settings,"2027-05-16")[0].adminOnly,true);
});

test("30-day and 7-day reminder identities are independent but stable across repeated scans",()=>{
  const at30=reminderEvents("maintenanceSchedule","v",scheduled,settings,"2027-10-16").filter(e=>e.kind==="expiry");
  const at7=reminderEvents("maintenanceSchedule","v",scheduled,settings,"2027-11-08").filter(e=>e.kind==="expiry");
  assert.equal(at30.length,1);assert.equal(at7.length,2);
  assert.equal(at30[0].sourceKey,at7[0].sourceKey);assert.notEqual(at7[0].sourceKey,at7[1].sourceKey);
  const ids=new Set([...at30,...at7,...at7].map(e=>notificationId(e.kind,e.sourceKey,"owner")));assert.equal(ids.size,2);
});
test("expired, future-starting, invalid, requested and completed visits do not generate maintenance reminders",()=>{
  for(const changes of [{expiresOn:"2027-05-01"},{startsOn:"2027-06-01"},{dueOn:"2027-02-30"},{requestId:"requested"},{status:"completed"},{workflowStatus:"confirmed"}])
    assert.equal(reminderEvents("maintenanceSchedule","v",{...scheduled,...changes},settings,"2027-05-16").filter(e=>e.kind==="maintenance").length,0);
});
