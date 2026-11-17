import { NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase/admin";
import { applyDelivery,equalSecret,validSignature } from "../../../../../scripts/whatsapp-outbox.mjs";
export const runtime="nodejs";
export async function GET(request:Request){
  const p=new URL(request.url).searchParams;
  if(p.get("hub.mode")!=="subscribe"||!equalSecret(p.get("hub.verify_token"),process.env.WHATSAPP_VERIFY_TOKEN))
    return new Response("Forbidden",{status:403});
  return new Response(p.get("hub.challenge")??"",{headers:{"Content-Type":"text/plain"}});
}
export async function POST(request:Request){
  const raw=await request.text();
  if(raw.length>262144)return new Response("Too large",{status:413});
  if(!validSignature(raw,request.headers.get("x-hub-signature-256"),process.env.WHATSAPP_APP_SECRET))
    return new Response("Forbidden",{status:403});
  try{
    const body=JSON.parse(raw);
    if(body.object!=="whatsapp_business_account")return new Response("Invalid object",{status:400});
    if(!process.env.WHATSAPP_PHONE_NUMBER_ID||process.env.AUTOMATION_PROJECT_ID!==process.env.FIREBASE_PROJECT_ID)
      return new Response("Not configured",{status:503});
    const {db}=adminServices();
    for(const entry of body.entry??[])for(const change of entry.changes??[]){
      if(change.field!=="messages"||change.value?.metadata?.phone_number_id!==process.env.WHATSAPP_PHONE_NUMBER_ID)continue;
      for(const status of change.value.statuses??[])await applyDelivery(db,status);
    }
    return NextResponse.json({received:true});
  }catch{return new Response("Webhook not processed; retry required",{status:503});}
}
