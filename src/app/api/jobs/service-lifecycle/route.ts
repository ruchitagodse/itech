import { NextResponse } from "next/server";
import { adminServices } from "@/lib/firebase/admin";
import { equalSecret } from "../../../../../scripts/whatsapp-outbox.mjs";
import { runLifecycleJobs } from "../../../../../scripts/lifecycle-jobs.mjs";
export const runtime="nodejs";
export const maxDuration=300;
export async function POST(request:Request){
  const secret=process.env.SERVICE_JOB_SECRET;
  if(!secret||secret.length<32||!equalSecret(request.headers.get("authorization"),"Bearer "+secret))
    return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!process.env.AUTOMATION_PROJECT_ID||process.env.AUTOMATION_PROJECT_ID!==process.env.FIREBASE_PROJECT_ID)
    return NextResponse.json({error:"Automation project is not explicitly enabled."},{status:503});
  try{const {db,auth}=adminServices();return NextResponse.json(await runLifecycleJobs(db,auth,{
    token:process.env.WHATSAPP_ACCESS_TOKEN,phoneId:process.env.WHATSAPP_PHONE_NUMBER_ID,apiVersion:process.env.WHATSAPP_API_VERSION
  }),{headers:{"Cache-Control":"no-store"}});}
  catch{return NextResponse.json({error:"Job incomplete. Retry safely; progress and deduplication are persisted."},{status:503});}
}
