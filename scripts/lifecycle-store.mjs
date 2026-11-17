import { periodVisit } from "./maintenance-visits.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { period, plusDays, indiaDate, validPolicy, isId, scheduleRows, scheduleId } from "./lifecycle-policy.mjs";
import { validPlanDate } from "./service-plan-dates.mjs";
export class LifecycleError extends Error { constructor(code){super(code);this.code=code;} }
const fail=code=>{throw new LifecycleError(code);};
const stamp=()=>FieldValue.serverTimestamp();
function checkedPeriod(start, policy) {
  try { return period(start, policy); }
  catch (error) { if (error.code === "schedule-conflict") fail("schedule-conflict"); throw error; }
}
export async function lifecycleAction(db, uid, input) {
  if(!isId(uid)||!input||typeof input!=="object")fail("invalid");
  const action=input.action;
  if(!["propose","agree","decline","confirm","cancel","followup","consent","settings"].includes(action))fail("invalid");
  return db.runTransaction(async tx=>{
    const actor=(await tx.get(db.doc("users/"+uid))).data();
    if(actor?.active!==true||!["admin","customer"].includes(actor.role))fail("forbidden");
    const admin=actor.role==="admin";
    if(action==="consent"){
      if(typeof input.enabled!=="boolean"||typeof input.phone!=="string"||input.enabled&&!/^\+[1-9][0-9]{9,14}$/.test(input.phone))fail("invalid");
      const ref=db.doc("notificationConsents/"+uid),old=await tx.get(ref);
      tx.set(ref,{uid,role:actor.role,enabled:input.enabled,phone:input.enabled?input.phone:"",
        version:(old.data()?.version??0)+1,scope:"service-and-renewal",updatedAt:stamp(),updatedBy:uid});
      return ref.id;
    }
    if(action==="settings"){
      if(!admin)fail("forbidden");
      for(const key of ["maintenanceLeadDays","expiryLeadDays","overdueRepeatDays","retryMinutes","maxAttempts"])
        if(!Number.isInteger(input[key])||input[key]<(key==="maintenanceLeadDays"||key==="expiryLeadDays"?0:1)||input[key]>365)fail("invalid");
      if(typeof input.enabled!=="boolean")fail("invalid");
      const templates=input.templates;
      if(!templates||typeof templates!=="object"||Array.isArray(templates))fail("invalid");
      for(const key of ["maintenance","expiry","followup","renewal","request"])
        if(!/^[a-z][a-z0-9_]{0,100}$/.test(templates[key]??""))fail("invalid");
      if(typeof input.language!=="string"||!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(input.language))fail("invalid");
      const previousSettings=(await tx.get(db.doc("settings/serviceAutomation"))).data();
      tx.set(db.doc("settings/serviceAutomation"),{enabled:input.enabled,maintenanceLeadDays:input.maintenanceLeadDays,
        expiryLeadDays:input.expiryLeadDays,expiryMilestonesDays:[30,7],overdueRepeatDays:input.overdueRepeatDays,retryMinutes:input.retryMinutes,
        enabledSince:previousSettings?.enabledSince ?? stamp(),
        maxAttempts:input.maxAttempts,templates:Object.fromEntries(["maintenance","expiry","followup","renewal","request"].map(k=>[k,templates[k]])),
        language:input.language,updatedBy:uid,updatedAt:stamp()});return "serviceAutomation";
    }
    if(action==="followup"){
      if(!admin)fail("forbidden");
      if(!isId(input.requestId)||!validPlanDate(input.dueOn)||typeof input.notes!=="string"||!input.notes.trim()||input.notes.length>1000||typeof input.closed!=="boolean")fail("invalid");
      const request=await tx.get(db.doc("serviceRequests/"+input.requestId));if(!request.exists)fail("not-found");
      const ref=db.doc("serviceFollowups/"+input.requestId);
      tx.set(ref,{requestId:request.id,customerId:request.data().customerId,applianceId:request.data().applianceId,
        dueOn:input.dueOn,notes:input.notes.trim(),closed:input.closed,updatedAt:stamp(),updatedBy:uid});return ref.id;
    }
    if(action==="propose"){
      if(!admin)fail("forbidden");
      if(!isId(input.customerId)||!isId(input.applianceId)||!isId(input.packageId))fail("invalid");
      const root=db.doc("customers/"+input.customerId+"/appliances/"+input.applianceId);
      const [customer,appliance,pkg,state]=await Promise.all([tx.get(db.doc("customers/"+input.customerId)),tx.get(root),
        tx.get(db.doc("servicePackages/"+input.packageId)),tx.get(root.collection("servicePlanState").doc("latest"))]);
      if(!customer.exists||!appliance.exists)fail("not-found");
      if(customer.data().active!==true||appliance.data().active!==true)fail("inactive");
      if(!isId(customer.data().ownerUid))fail("owner-required");
      const source=pkg.data();if(!source?.active||source.serviceType!=="maintenance"||source.applianceType!==appliance.data().type||!validPolicy(source.policy))fail("policy-required");
      const latestId=state.data()?.latestPlanId;if(!isId(latestId))fail("plan-required");
      const latest=await tx.get(root.collection("servicePlans").doc(latestId));if(!latest.exists)fail("conflict");
      const ref=db.collection("renewals").doc(),lock=db.doc("renewalLocks/"+input.customerId.length+"-"+input.customerId+"-"+input.applianceId);
      const pending=await tx.get(lock);if(pending.exists)fail("pending-renewal");
      const start=plusDays(latest.data().expiresOn,1),dates=checkedPeriod(start<indiaDate()?indiaDate():start,source.policy);
      tx.create(ref,{customerId:input.customerId,applianceId:input.applianceId,ownerUid:customer.data().ownerUid,
        previousPlanId:latestId,packageId:pkg.id,packageVersion:source.version,name:source.name,pricePaise:source.pricePaise,
        ...dates,status:"awaiting_customer",version:1,createdAt:stamp(),createdBy:uid,updatedAt:stamp(),updatedBy:uid});
      tx.create(lock,{renewalId:ref.id});return ref.id;
    }
    if(!isId(input.id)||!Number.isInteger(input.expectedVersion))fail("invalid");
    const ref=db.doc("renewals/"+input.id),snap=await tx.get(ref);if(!snap.exists)fail("not-found");
    const data=snap.data(),customer=await tx.get(db.doc("customers/"+data.customerId));
    if(!admin&&(actor.role!=="customer"||customer.data()?.ownerUid!==uid||data.ownerUid!==uid))fail("forbidden");
    if(data.version!==input.expectedVersion)fail("conflict");
    const lock=db.doc("renewalLocks/"+data.customerId.length+"-"+data.customerId+"-"+data.applianceId);
    const lockData=await tx.get(lock);if(lockData.data()?.renewalId!==snap.id)fail("conflict");
    if(action==="cancel"){
      if(!admin||!["awaiting_customer","agreed"].includes(data.status))fail("transition");
      tx.update(ref,{status:"withdrawn",version:data.version+1,updatedAt:stamp(),updatedBy:uid});tx.delete(lock);return ref.id;
    }
    if(action==="agree"||action==="decline"){
      if(admin||data.status!=="awaiting_customer")fail("transition");
      if(customer.data()?.active!==true)fail("inactive");
      tx.update(ref,{status:action==="agree"?"agreed":"declined",version:data.version+1,agreedBy:action==="agree"?uid:null,
        agreedAt:action==="agree"?stamp():null,updatedAt:stamp(),updatedBy:uid});
      if(action==="decline")tx.delete(lock);return ref.id;
    }
    if(action!=="confirm"||!admin||data.status!=="agreed")fail("transition");
    const root=db.doc("customers/"+data.customerId+"/appliances/"+data.applianceId);
    const [appliance,state,pkg,owner]=await Promise.all([tx.get(root),tx.get(root.collection("servicePlanState").doc("latest")),
      tx.get(db.doc("servicePackages/"+data.packageId)),tx.get(db.doc("users/"+data.agreedBy))]);
    if(customer.data()?.active!==true||appliance.data()?.active!==true||owner.data()?.active!==true||owner.data()?.role!=="customer")fail("inactive");
    if(customer.data().ownerUid!==data.agreedBy||state.data()?.latestPlanId!==data.previousPlanId)fail("conflict");
    if(pkg.data()?.active!==true||pkg.data()?.version!==data.packageVersion)fail("package-changed");
    if(data.expiresOn<indiaDate())fail("expired");
    const planRef=root.collection("servicePlans").doc();
    const {dueDates,...dates}=checkedPeriod(data.startsOn,data.policy);
    tx.create(planRef,{...dates,name:data.name,packageId:data.packageId,renewedFrom:data.previousPlanId,renewalId:ref.id,
      createdAt:stamp(),createdBy:uid,updatedAt:stamp(),updatedBy:uid});
    for(const row of scheduleRows({...data,...dates,dueDates,planId:planRef.id,customerName:customer.data().fullName,applianceLabel:appliance.data().brand+" "+appliance.data().model}))
    {
      const visitId = scheduleId(planRef.id, row.visit);
      tx.create(db.doc("maintenanceSchedule/" + visitId), row);
      tx.create(planRef.collection("maintenanceVisits").doc(visitId), periodVisit(row, uid));
    }
    tx.set(root.collection("servicePlanState").doc("latest"),{latestPlanId:planRef.id});
    tx.update(ref,{status:"confirmed",planId:planRef.id,confirmedBy:uid,confirmedAt:stamp(),version:data.version+1,updatedAt:stamp(),updatedBy:uid});
    tx.delete(lock);return planRef.id;
  });
}
