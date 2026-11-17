import { randomUUID } from "node:crypto";
import { FieldPath } from "firebase-admin/firestore";
import { indiaDate,plusDays } from "./lifecycle-policy.mjs";
import { validPlanDate } from "./service-plan-dates.mjs";
import { enqueue,dispatchNotification } from "./whatsapp-outbox.mjs";
export function reminderEvents(view,id,d,settings,today=indiaDate()){
  if(!d.customerId)return [];
  if(view==="maintenanceSchedule"){
    if(!validPlanDate(d.dueOn)||!validPlanDate(d.expiresOn)||d.expiresOn<today
      ||d.dueOn>d.expiresOn||d.startsOn&&(!validPlanDate(d.startsOn)||d.startsOn>today||d.dueOn<d.startsOn))return [];
    const events=[],scope={applianceId:d.applianceId??null,planId:d.planId,visitId:id,startsOn:d.startsOn??null,expiresOn:d.expiresOn};
    if(d.status!=="completed"&&!d.requestId&&(!d.workflowStatus||d.workflowStatus==="scheduled")
      &&d.dueOn<=plusDays(today,settings.maintenanceLeadDays)){
      const bucket=d.dueOn<today?Math.floor((Date.parse(today)-Date.parse(d.dueOn))/86400000/settings.overdueRepeatDays):"initial";
      events.push({...scope,kind:"maintenance",sourceKey:id+"_"+bucket,customerId:d.customerId,parameters:[d.planName,d.dueOn,id]});
    }
    // Each reached milestone can be caught up while the period is still valid.
    // A stable milestone key makes repeated scans and recipient retries idempotent.
    if(d.visit===1)for(const days of [30,7]){
      if(d.expiresOn<=plusDays(today,days))
        events.push({...scope,kind:"expiry",sourceKey:d.planId+"_"+d.expiresOn+"_day_"+days,
          customerId:d.customerId,parameters:[d.planName,d.expiresOn,d.planId]});
    }
    return events;
  }
  if(view==="renewals"&&["awaiting_customer","agreed","confirmed"].includes(d.status))
    return [{kind:"renewal",sourceKey:id+"_"+d.status,customerId:d.customerId,parameters:[d.name+" — "+d.status,d.startsOn,id]}];
  if(view==="serviceFollowups"&&!d.closed&&d.dueOn<=today){
    const bucket=Math.floor((Date.parse(today)-Date.parse(d.dueOn))/86400000/settings.overdueRepeatDays);
    return [{kind:"followup",sourceKey:id+"_"+d.dueOn+"_"+bucket,customerId:d.customerId,parameters:["Service follow-up",d.dueOn,id],adminOnly:true}];
  }
  if(view==="serviceEvents"){
    if(settings.enabledSince?.toMillis && d.createdAt?.toMillis && d.createdAt.toMillis()<settings.enabledSince.toMillis()) return [];
    return [{kind:"request",sourceKey:id,customerId:d.customerId,parameters:[d.serviceType+" — "+(d.eventLabel??d.event),d.businessDate,d.requestId]}];
  }
  return [];
}
async function processLifecycleJobs(db,auth,config){
  const settings=(await db.doc("settings/serviceAutomation").get()).data();
  if(!settings?.enabled)return {enabled:false,scanned:0,queued:0,processed:0};
  let scanned=0,queued=0,processed=0;
  const deadline=Date.now()+200000;
  const admins=(await db.collection("notificationConsents").where("role","==","admin").get()).docs.filter(d=>d.data().enabled).map(d=>d.id);
  for(const view of ["maintenanceSchedule","renewals","serviceFollowups","serviceEvents"]){
    const cursorRef=db.doc("automationCursors/"+view),cursor=(await cursorRef.get()).data()?.lastId;
    let query=db.collection(view).orderBy(FieldPath.documentId());if(cursor)query=query.startAfter(cursor);
    const page=await query.limit(50).get();
    let lastId=cursor??null,handled=0;
    for(const doc of page.docs){
      if(Date.now()>deadline)break;
      scanned++;
      for(const event of reminderEvents(view,doc.id,doc.data(),settings)){
        const customer=(await db.doc("customers/"+event.customerId).get()).data();
        const recipients=[...new Set([...admins,...(!event.adminOnly&&customer?.ownerUid?[customer.ownerUid]:[])])];
        for(const uid of recipients)if(await enqueue(db,event,uid))queued++;
      }
      lastId=doc.id;handled++;
    }
    // Cursor advances only after this page succeeds; retries replay deterministic event IDs.
    await cursorRef.set({lastId:handled<page.size||page.size===50?lastId:null});
  }
  // Each state has an independent cursor so terminal notifications never starve queued work.
  const rotationRef=db.doc("automationCursors/dispatchRotation"),rotation=(await rotationRef.get()).data()?.index??0;
  const states=["queued","retry","sending"];
  for(let offset=0;offset<states.length;offset++){
    const status=states[(rotation+offset)%states.length];
    if(processed>=5||Date.now()>deadline)break;
    const cursorRef=db.doc("automationCursors/dispatch_"+status),cursor=(await cursorRef.get()).data()?.lastId;
    let query=db.collection("notifications").where("status","==",status).orderBy(FieldPath.documentId());if(cursor)query=query.startAfter(cursor);
    const page=await query.limit(25).get();
    let lastId=cursor??null,handled=0;
    for(const doc of page.docs){if(processed>=5||Date.now()>deadline)break;await dispatchNotification(db,auth,doc.id,settings,config);processed++;handled++;lastId=doc.id;}
    await cursorRef.set({lastId:handled<page.size||page.size===25?lastId:null});
  }
  await rotationRef.set({index:(rotation+1)%states.length});
  return {enabled:true,scanned,queued,processed,providerConfigured:!!config.token&&!!config.phoneId&&!!config.apiVersion};
}

export async function runLifecycleJobs(db,auth,config){
  const ref=db.doc("automationLocks/lifecycle"),owner=randomUUID(),now=Date.now();
  const acquired=await db.runTransaction(async tx=>{const old=await tx.get(ref);if((old.data()?.until??0)>now)return false;tx.set(ref,{owner,until:now+290000});return true;});
  if(!acquired)return {busy:true,scanned:0,queued:0,processed:0};
  try{return await processLifecycleJobs(db,auth,config);}
  finally{await db.runTransaction(async tx=>{const lock=await tx.get(ref);if(lock.data()?.owner===owner)tx.delete(ref);});}
}