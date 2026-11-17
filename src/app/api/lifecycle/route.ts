import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { lifecyclePage,performLifecycle,LifecycleError,views,type LifecycleView } from "@/lib/lifecycle/server";
export const runtime="nodejs";
function errorResponse(error:unknown){
  if(error instanceof LifecycleError){
    const messages:Record<string,string>={"schedule-conflict":"Both included visits must fit inside the plan period at the configured frequency. Choose sufficient validity; existing periods are unchanged.",invalid:"Check the submitted details.",forbidden:"Access denied.","not-found":"Record not found.",conflict:"The record changed. Refresh and try again.",transition:"This action is not available.","policy-required":"Configure an active maintenance package with a validity policy.","owner-required":"Link a Customer account before requesting agreement.","plan-required":"Create the initial installed-appliance plan first.","pending-renewal":"A renewal is already awaiting a decision.","package-changed":"Package terms changed. Create a new renewal proposal.",inactive:"The customer, appliance or account is inactive.",expired:"The proposed period has expired."};
    return NextResponse.json({error:messages[error.code]??"Action unavailable."},{status:error.code==="forbidden"?403:error.code==="invalid"?400:error.code==="not-found"?404:409});
  }
  return NextResponse.json({error:"Service lifecycle is unavailable. Please retry."},{status:503});
}
export async function GET(request:Request){
  const profile=await currentProfile();if(!profile)return NextResponse.json({error:"Please sign in."},{status:401});
  try{const search=new URL(request.url).searchParams,view=search.get("view") as LifecycleView;
    if(!views.includes(view))throw new LifecycleError("invalid");
    return NextResponse.json(await lifecyclePage(profile,view,search.get("cursor")??""),{headers:{"Cache-Control":"no-store"}});
  }catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:"Request origin rejected."},{status:403});
  const profile=await currentProfile();if(!profile)return NextResponse.json({error:"Please sign in."},{status:401});
  if(profile.role==="technician")return NextResponse.json({error:"Access denied."},{status:403});
  try{return NextResponse.json({id:await performLifecycle(profile,await customerBody(request))},{headers:{"Cache-Control":"no-store"}});}
  catch(error){return errorResponse(error);}
}
