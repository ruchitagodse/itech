import { FieldValue } from "firebase-admin/firestore";
import { indiaDate } from "./service-plan-dates.mjs";
// Append after authorization and transaction reads, atomically with the source mutation.
export function recordServiceEvent(tx,db,requestId,data,event,actorUid){
  tx.create(db.doc("serviceEvents/"+requestId+"_"+event),{requestId,customerId:data.customerId,applianceId:data.applianceId,
    serviceType:data.serviceType,status:data.status,event,eventLabel:event==="created"?"Request received":event.startsWith("assignment_")?"Technician assignment updated":data.status.replaceAll("_"," "),businessDate:indiaDate(),createdBy:actorUid,createdAt:FieldValue.serverTimestamp()});
}