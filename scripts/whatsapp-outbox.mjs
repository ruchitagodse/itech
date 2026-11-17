import { createHash,createHmac,timingSafeEqual } from "node:crypto";
import { indiaDate, validPlanDate } from "./service-plan-dates.mjs";
import { FieldValue } from "firebase-admin/firestore";
export const notificationId=(...parts)=>createHash("sha256").update(JSON.stringify(parts)).digest("hex");
export function equalSecret(a,b){
  if(typeof a!=="string"||typeof b!=="string"||!b)return false;
  const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);
}
export function validSignature(raw,signature,secret){
  return !!secret&&equalSecret(signature,"sha256="+createHmac("sha256",secret).update(raw).digest("hex"));
}
export function nextDelivery(current,incoming){
  const ranks={accepted:0,sent:1,delivered:2,read:3};
  if(incoming==="failed")return ["delivered","read"].includes(current)?current:"failed";
  return (ranks[incoming]??-1)>(ranks[current]??-1)?incoming:current;
}
export function noticeDatesCurrent(data, today = indiaDate()) {
  if (!["maintenance", "expiry"].includes(data.kind)) return true;
  return validPlanDate(data.expiresOn) && data.expiresOn >= today
    && (data.kind !== "maintenance" || !data.startsOn || validPlanDate(data.startsOn) && data.startsOn <= today);
}
export async function enqueue(db,event,recipientUid){
  const id=notificationId(event.kind,event.sourceKey,recipientUid),ref=db.doc("notifications/"+id);
  return db.runTransaction(async tx=>{
    const [old,consent,actor,customer]=await Promise.all([tx.get(ref),tx.get(db.doc("notificationConsents/"+recipientUid)),
      tx.get(db.doc("users/"+recipientUid)),tx.get(db.doc("customers/"+event.customerId))]);
    if(old.exists)return false;
    const c=consent.data(),a=actor.data(),parent=customer.data();
    if(!c?.enabled||a?.active!==true||!["admin","customer"].includes(a.role)||parent?.active!==true
      ||a.role==="customer"&&parent.ownerUid!==recipientUid)return false;
    tx.create(ref,{kind:event.kind,sourceKey:event.sourceKey,customerId:event.customerId,recipientUid,recipientRole:a.role,
      ...(event.kind==="maintenance"||event.kind==="expiry" ? {expiresOn:event.expiresOn??null,startsOn:event.startsOn??null,
        planId:event.planId??null,applianceId:event.applianceId??null,visitId:event.visitId??null} : {}),
      phone:c.phone,consentVersion:c.version,parameters:event.parameters,status:"queued",attempts:0,nextAttemptAt:0,
      createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return true;
  });
}
export async function dispatchNotification(db,auth,id,settings,config,send=fetch,now=Date.now()){
  if(!config.token||!config.phoneId||!/^v[0-9]+\.[0-9]+$/.test(config.apiVersion??""))return "not-configured";
  const ref=db.doc("notifications/"+id);
  const claim=await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),data=snap.data();if(!data)return null;
    // A crashed/in-flight send has an ambiguous provider outcome. Never resend it automatically.
    if(data.status==="sending"){
      if(data.leaseUntil<now)tx.update(ref,{status:"uncertain",lastError:"Dispatch interrupted; reconcile provider status before retrying.",updatedAt:FieldValue.serverTimestamp()});
      return null;
    }
    if(!["queued","retry"].includes(data.status)||data.nextAttemptAt>now||data.attempts>=settings.maxAttempts)return null;
    const [consent,user,customer]=await Promise.all([tx.get(db.doc("notificationConsents/"+data.recipientUid)),
      tx.get(db.doc("users/"+data.recipientUid)),tx.get(db.doc("customers/"+data.customerId))]);
    const c=consent.data(),a=user.data(),parent=customer.data();
    if(!c?.enabled||c.version!==data.consentVersion||c.phone!==data.phone||a?.active!==true
      ||a.role!==data.recipientRole||parent?.active!==true||a.role==="customer"&&parent.ownerUid!==data.recipientUid){
      tx.update(ref,{status:"suppressed",lastError:"Consent or recipient eligibility changed."});return null;
    }
    if(!noticeDatesCurrent(data,indiaDate(new Date(now)))){
      tx.update(ref,{status:"suppressed",lastError:"Plan period is expired, not started, or legacy reminder dates require review.",updatedAt:FieldValue.serverTimestamp()});return null;
    }
    const template=settings.templates?.[data.kind];if(!template)return null;
    tx.update(ref,{status:"sending",attempts:data.attempts+1,leaseUntil:now+60000,updatedAt:FieldValue.serverTimestamp()});
    return {...data,attempts:data.attempts+1,template};
  });
  if(!claim)return "skipped";
  let account;
  try{account=await auth.getUser(claim.recipientUid);}catch{await ref.update({status:"suppressed",lastError:"Recipient identity unavailable."});return "suppressed";}
  if(account.disabled||!account.emailVerified){await ref.update({status:"suppressed",lastError:"Recipient identity is disabled or unverified."});return "suppressed";}
  // Recheck consent immediately before the external side effect.
  const latest=(await db.doc("notificationConsents/"+claim.recipientUid).get()).data();
  const liveSettings=(await db.doc("settings/serviceAutomation").get()).data();
  if(liveSettings?.enabled===false){await ref.update({status:"queued",attempts:claim.attempts-1});return "paused";}
  if(!latest?.enabled||latest.version!==claim.consentVersion){await ref.update({status:"suppressed"});return "suppressed";}
  if(!noticeDatesCurrent(claim)){
    await ref.update({status:"suppressed",lastError:"Plan validity ended before dispatch."});return "suppressed";
  }
  try{
    const response=await send("https://graph.facebook.com/"+config.apiVersion+"/"+config.phoneId+"/messages",{
      method:"POST",headers:{Authorization:"Bearer "+config.token,"Content-Type":"application/json"},
      signal:AbortSignal.timeout(15000),
      body:JSON.stringify({messaging_product:"whatsapp",recipient_type:"individual",to:claim.phone,type:"template",biz_opaque_callback_data:id,
        template:{name:claim.template,language:{code:settings.language},components:[{type:"body",parameters:claim.parameters.map(text=>({type:"text",text}))}]}})
    });
    if(!response.ok){
      const retry=response.status===429&&claim.attempts<settings.maxAttempts;
      await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data()?.status==="sending")tx.update(ref,{status:retry?"retry":response.status>=500?"uncertain":"failed",nextAttemptAt:now+settings.retryMinutes*60000*2**(claim.attempts-1),lastError:"Provider HTTP "+response.status,updatedAt:FieldValue.serverTimestamp()});});
      return retry?"retry":"failed";
    }
    const result=await response.json(),providerId=result.messages?.[0]?.id;
    if(typeof providerId!=="string"||providerId.length>512)throw Error("ambiguous-response");
    await db.runTransaction(async tx=>{
      const current=await tx.get(ref);
      tx.set(db.doc("notificationProviderIds/"+notificationId(providerId)),{notificationId:id});
      tx.update(ref,{providerId,status:["sent","delivered","read","failed"].includes(current.data()?.status)?current.data().status:"accepted",lastError:null,updatedAt:FieldValue.serverTimestamp()});
    });
    return "accepted";
  }catch{
    await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data()?.status==="sending")tx.update(ref,{status:"uncertain",lastError:"Provider outcome unknown; automatic retry withheld.",updatedAt:FieldValue.serverTimestamp()});});
    return "uncertain";
  }
}
export async function applyDelivery(db,status){
  if(typeof status.id!=="string"||status.id.length>512||!["sent","delivered","read","failed"].includes(status.status)||!/^\d{1,12}$/.test(status.timestamp??""))return false;
  const eventId=notificationId(status.id,status.status,status.timestamp),eventRef=db.doc("notificationEvents/"+eventId);
  return db.runTransaction(async tx=>{
    const [event,mapping]=await Promise.all([tx.get(eventRef),tx.get(db.doc("notificationProviderIds/"+notificationId(status.id)))]);
    if(event.exists)return false;
    const correlation=status.biz_opaque_callback_data;
    const id=mapping.data()?.notificationId??(/^[a-f0-9]{64}$/.test(correlation??"")?correlation:null);
    if(!id)return false;
    const ref=db.doc("notifications/"+id),snap=await tx.get(ref),data=snap.data();
    if(!data||data.providerId&&data.providerId!==status.id||!["sending","uncertain","accepted","sent","delivered","read","failed"].includes(data.status))return false;
    const next=nextDelivery(data.status,status.status);
    tx.create(eventRef,{notificationId:id,providerId:status.id,status:status.status,providerTimestamp:status.timestamp,receivedAt:FieldValue.serverTimestamp()});
    tx.update(ref,{providerId:status.id,status:next,updatedAt:FieldValue.serverTimestamp(),...(next==="delivered"||next==="read"?{deliveredAt:FieldValue.serverTimestamp()}:{}),...(next==="read"?{readAt:FieldValue.serverTimestamp()}:{} )});
    return true;
  });
}
