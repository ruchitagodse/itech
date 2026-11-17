"use client";
import { useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LifecycleRow } from "@/lib/lifecycle/server";
import type { ServicePackageRecord } from "@/lib/service-packages/data";
async function submitAction(input:Record<string,unknown>){
  const response=await fetch("/api/lifecycle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
  const result=await response.json();if(!response.ok)throw Error(result.error??"Unable to save.");return result;
}
export function LifecycleButton({action,row,children}:{action:string;row:LifecycleRow;children:React.ReactNode}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),router=useRouter();
  return <div><button className="button secondary" disabled={busy} onClick={async()=>{setBusy(true);setMessage("");try{await submitAction({action,id:row.id,expectedVersion:row.version});setMessage("Saved.");router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to save.");}finally{setBusy(false);}}}>{busy?"Saving…":children}</button>{message&&<p role="status">{message}</p>}</div>;
}
export function ConsentForm({initial}:{initial:{phone:string;enabled:boolean}}){
  const [phone,setPhone]=useState(initial.phone),[enabled,setEnabled]=useState(initial.enabled),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");try{await submitAction({action:"consent",phone,enabled});setMessage("WhatsApp preference saved.");}catch(e){setMessage(e instanceof Error?e.message:"Unable to save.");}finally{setBusy(false);}}
  return <form className="customer-details-panel provision-form" onSubmit={submit}><h2>WhatsApp preferences</h2><p>Receive service, maintenance and renewal updates. You can withdraw consent here at any time.</p><div className="field"><label htmlFor="wa-phone">Your WhatsApp number (e.g. +919876543210)</label><input id="wa-phone" value={phone} disabled={busy} onChange={e=>setPhone(e.target.value)} maxLength={16}/></div><label><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>setEnabled(e.target.checked)}/> I agree to receive service and renewal WhatsApp notifications from iTech.</label><button className="button primary" disabled={busy}>{busy?"Saving…":"Save preference"}</button>{message&&<p role="status">{message}</p>}</form>;
}
export function RenewalForm({customerId,applianceId,packages}:{customerId:string;applianceId:string;packages:ServicePackageRecord[]}){
  const router=useRouter();
  const [packageId,setPackage]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  return <form className="customer-details-panel provision-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage("");try{await submitAction({action:"propose",customerId,applianceId,packageId});setMessage("Proposal created. The customer must agree before Admin confirmation.");router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to save.");}finally{setBusy(false);}}}><h2>Propose renewal</h2><p>Package price, validity and maintenance interval are saved with this offer. The new period starts after the latest expiry, or today if it already expired.</p><div className="field"><label htmlFor="renew-package">Maintenance package</label><select id="renew-package" required value={packageId} onChange={e=>setPackage(e.target.value)}><option value="">Select a configured package</option>{packages.filter(p=>p.active&&p.serviceType==="maintenance"&&p.policy).map(p=><option key={p.id} value={p.id}>{p.name} — ₹{p.pricePaise/100}</option>)}</select></div><button className="button primary" disabled={busy}>{busy?"Saving…":"Send proposal for customer agreement"}</button>{message&&<p role="status">{message}</p>}</form>;
}
export function FollowupForm({requestId=""}:{requestId?:string}){
  const router=useRouter();
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  return <form className="customer-details-panel provision-form" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);setMessage("");try{await submitAction({action:"followup",requestId:data.get("requestId"),dueOn:data.get("dueOn"),notes:data.get("notes"),closed:data.get("closed")==="on"});setMessage("Follow-up saved.");router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to save.");}finally{setBusy(false);}}}><h2>Service follow-up</h2><div className="field"><label htmlFor="follow-request">Request ID</label><input id="follow-request" name="requestId" defaultValue={requestId} required maxLength={128}/></div><div className="field"><label htmlFor="follow-date">Follow-up date (IST)</label><input id="follow-date" name="dueOn" type="date" required/></div><div className="field"><label htmlFor="follow-notes">Internal notes</label><textarea id="follow-notes" name="notes" required maxLength={1000}/></div><label><input type="checkbox" name="closed"/> Close follow-up</label><button className="button primary" disabled={busy}>{busy?"Saving…":"Save follow-up"}</button>{message&&<p role="status">{message}</p>}</form>;
}
