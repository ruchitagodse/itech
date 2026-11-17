import "server-only";
import { FieldPath } from "firebase-admin/firestore";
import type { Profile } from "@/lib/roles";
import { adminServices } from "@/lib/firebase/admin";
import { ownCustomer } from "@/lib/customers/server";
import { LifecycleError, lifecycleAction } from "../../../scripts/lifecycle-store.mjs";
import { indiaDate, plusDays } from "../../../scripts/lifecycle-policy.mjs";
export { LifecycleError };
export const views = ["maintenanceSchedule","renewals","serviceFollowups","notifications"] as const;
export type LifecycleView = typeof views[number];
export type LifecycleRow = Record<string, string | number | boolean | null>;
const fields = ["customerId","applianceId","planId","planName","customerName","applianceLabel","dueOn","expiresOn","visit","status","workflowStatus","requestId","name","pricePaise","startsOn","version","notes","closed","kind","recipientUid","attempts","lastError","providerId","phone","updatedAt","createdAt"];
function row(id:string,data:FirebaseFirestore.DocumentData): LifecycleRow {
  const result:LifecycleRow={id};
  for(const key of fields){const v=data[key];if(v?.toDate)result[key]=v.toDate().toISOString();else if(v===null||["string","number","boolean"].includes(typeof v))result[key]=v;}
  return result;
}
export async function lifecyclePage(profile:Profile,view:LifecycleView,cursor="") {
  if(profile.role==="technician"||!views.includes(view))throw new LifecycleError("forbidden");
  if(profile.role!=="admin"&&view==="serviceFollowups")throw new LifecycleError("forbidden");
  if(cursor&&!/^[a-zA-Z0-9_-]{1,128}$/.test(cursor))throw new LifecycleError("invalid");
  const db=adminServices().db,collection=db.collection(view);
  let q:FirebaseFirestore.Query=collection;
  if(profile.role==="customer"){
    if(view==="notifications")q=q.where("recipientUid","==",profile.uid);
    else {const customer=await ownCustomer(profile);if(!customer)return {items:[],nextCursor:null};q=q.where("customerId","==",customer.id);}
  }
  if(view==="maintenanceSchedule") {
    q=q.orderBy("dueOn").orderBy(FieldPath.documentId());
    if(cursor){const marker=await collection.doc(cursor).get();if(!marker.exists)throw new LifecycleError("invalid");if(profile.role==="customer"){const own=await ownCustomer(profile);if(marker.data()?.customerId!==own?.id)throw new LifecycleError("forbidden");}q=q.startAfter(marker);}
  } else { q=q.orderBy(FieldPath.documentId()); if(cursor)q=q.startAfter(cursor); }
  const page=await q.limit(51).get(),items=page.docs.slice(0,50).map(d=>row(d.id,d.data()));
  return {items,nextCursor:page.size>50?items[items.length-1].id as string:null};
}
export async function lifecycleSettings(profile:Profile){
  if(profile.role!=="admin")throw new LifecycleError("forbidden");
  const snap=await adminServices().db.doc("settings/serviceAutomation").get();
  return snap.exists?JSON.parse(JSON.stringify(snap.data())):null;
}
export async function ownConsent(profile:Profile){
  if(!["admin","customer"].includes(profile.role))throw new LifecycleError("forbidden");
  const data=(await adminServices().db.doc("notificationConsents/"+profile.uid).get()).data();
  return {phone:typeof data?.phone==="string"?data.phone:"",enabled:data?.enabled===true};
}
export async function performLifecycle(profile:Profile,input:Record<string,unknown>){
  return lifecycleAction(adminServices().db,profile.uid,input);
}
export async function lifecycleKpis(profile:Profile){
  if(profile.role!=="admin")throw new LifecycleError("forbidden");
  const db=adminServices().db,today=indiaDate(),settings=(await db.doc("settings/serviceAutomation").get()).data();
  const cutoff=plusDays(today,Number.isInteger(settings?.expiryLeadDays)?settings!.expiryLeadDays:0);
  const [pending,inProgress,renewals,overdue,upcoming,expiring]=await Promise.all([
    db.collection("serviceRequests").where("status","==","pending").count().get(),
    db.collection("serviceRequests").where("status","==","in_progress").count().get(),
    db.collection("renewals").where("status","in",["awaiting_customer","agreed"]).count().get(),
    db.collection("maintenanceSchedule").where("status","==","due").where("dueOn","<",today).where("expiresOn",">=",today).count().get(),
    db.collection("maintenanceSchedule").where("status","==","due").where("dueOn",">=",today).count().get(),
    db.collection("maintenanceSchedule").where("visit","==",1).where("expiresOn",">=",today).where("expiresOn","<=",cutoff).count().get()
  ]);
  return {pending:pending.data().count,inProgress:inProgress.data().count,pendingRenewals:renewals.data().count,
    overdueVisits:overdue.data().count,upcomingVisits:upcoming.data().count,expiringPlans:expiring.data().count,
    expiryWindowDays:settings?.expiryLeadDays??0};
}
