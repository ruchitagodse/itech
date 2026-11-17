"use client";
import { useState } from "react";
type Settings={enabled:boolean;maintenanceLeadDays:number;expiryLeadDays:number;overdueRepeatDays:number;retryMinutes:number;maxAttempts:number;language:string;templates:Record<string,string>};
export function AutomationSettings({initial}:{initial:Settings|null}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  return <form className="customer-details-panel provision-form" onSubmit={async e=>{
    e.preventDefault();setBusy(true);setMessage("");const form=new FormData(e.currentTarget);
    const payload:Record<string,unknown>={action:"settings",enabled:form.get("enabled")==="on",language:form.get("language"),
      templates:Object.fromEntries(["maintenance","expiry","followup","renewal","request"].map(k=>[k,form.get(k)]))};
    for(const k of ["maintenanceLeadDays","expiryLeadDays","overdueRepeatDays","retryMinutes","maxAttempts"])payload[k]=Number(form.get(k));
    try{const response=await fetch("/api/lifecycle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),result=await response.json();if(!response.ok)throw Error(result.error);setMessage("Automation configuration saved.");}catch(e){setMessage(e instanceof Error?e.message:"Could not save.");}finally{setBusy(false);}
  }}><h2>Reminder configuration</h2><p>Configure intervals and Meta-approved templates before enabling. Every template must have exactly three body text parameters: event label, business date and reference ID. Expiry reminder milestones are 30 and 7 days, with independent event identities. The expiry window below controls the dashboard KPI. These are service notices; no messages are sent by this form.</p>
  <label><input name="enabled" type="checkbox" defaultChecked={initial?.enabled}/> Enable scheduled generation and sending</label>
  <div className="provision-fields">{(["maintenanceLeadDays","expiryLeadDays","overdueRepeatDays","retryMinutes","maxAttempts"] as const).map(k=><div className="field" key={k}><label htmlFor={k}>{{maintenanceLeadDays:"Maintenance notice (days before due)",expiryLeadDays:"Expiring-plan KPI window (days)",overdueRepeatDays:"Repeat overdue notice every (days)",retryMinutes:"Retry base delay (minutes)",maxAttempts:"Maximum send attempts"}[k]}</label><input id={k} name={k} type="number" required min={k.endsWith("LeadDays")?0:1} max={365} defaultValue={initial?.[k]}/></div>)}
  <div className="field"><label htmlFor="template-language">Approved template language</label><input id="template-language" name="language" required placeholder="e.g. en_US" defaultValue={initial?.language}/></div>
  {["maintenance","expiry","followup","renewal","request"].map(k=><div className="field" key={k}><label htmlFor={"template-"+k}>{k} template name</label><input id={"template-"+k} name={k} required pattern="[a-z][a-z0-9_]*" defaultValue={initial?.templates[k]}/></div>)}</div>
  <button className="button primary" disabled={busy}>{busy?"Saving…":"Save automation settings"}</button>{message&&<p role="status">{message}</p>}</form>;
}
