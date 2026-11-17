import { currentProfile } from "@/lib/auth";
import { lifecyclePage,views,type LifecycleView } from "@/lib/lifecycle/server";
export const runtime="nodejs";
export async function GET(request:Request){
  const profile=await currentProfile();if(!profile)return new Response("Please sign in.",{status:401});
  if(profile.role!=="admin")return new Response("Access denied.",{status:403});
  const p=new URL(request.url).searchParams,view=p.get("view") as LifecycleView;
  if(!views.includes(view))return new Response("Invalid report.",{status:400});
  try{const {items,nextCursor}=await lifecyclePage(profile,view,p.get("cursor")??"");
    const keys=[...new Set(items.flatMap(item=>Object.keys(item)))];
    const cell=(v:unknown)=>{let text=String(v??"");if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
    const csv=[keys.map(cell).join(","),...items.map(item=>keys.map(key=>cell(item[key])).join(","))].join("\r\n");
    return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="'+view+'-page.csv"',"Cache-Control":"no-store","X-Has-More":String(!!nextCursor)}});
  }catch{return new Response("Report unavailable.",{status:503});}
}
