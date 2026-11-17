import Link from "next/link";
import type { Profile } from "@/lib/roles";
import { lifecyclePage,lifecycleKpis,lifecycleSettings,ownConsent,type LifecycleView } from "@/lib/lifecycle/server";
import { listServicePackages } from "@/lib/service-packages/server";
import { ConsentForm,FollowupForm,RenewalForm,LifecycleButton } from "./actions";
import { AutomationSettings } from "./settings-form";
import { indiaDate,serviceDueStatus } from "../../../scripts/lifecycle-policy.mjs";
const fieldLabels:Record<string,string>={dueOn:"Due date (IST)",expiresOn:"Valid through (inclusive)",visit:"Maintenance visit",status:"Record status",workflowStatus:"Visit stage",requestId:"Service request",pricePaise:"Renewal price (INR)",startsOn:"Valid from",notes:"Internal notes",closed:"Follow-up closed",attempts:"Send attempts",lastError:"Sending information",createdAt:"Created",updatedAt:"Last updated"};
const labels={maintenanceSchedule:"Service calendar",renewals:"Renewals",serviceFollowups:"Follow-ups",notifications:"Notification history"};
export async function LifecycleOverview({profile,search}:{profile:Profile;search:Record<string,string|undefined>}){
  const admin=profile.role==="admin",base="/"+profile.role+"/lifecycle";
  const view=(Object.keys(labels).includes(search.view??"")?search.view:"maintenanceSchedule") as LifecycleView;
  const {items,nextCursor}=await lifecyclePage(profile,view,search.cursor),consent=await ownConsent(profile);
  const kpis=admin?await lifecycleKpis(profile):null;
  const settings=admin?await lifecycleSettings(profile):null;
  const packages=admin&&search.customerId&&search.applianceId?await listServicePackages(profile,search.packageCursor):null;
  return <><div className="page-heading"><div><p className="eyebrow">SERVICE LIFECYCLE</p><h1>Care, from installation to renewal.</h1><p className="muted">All dates use Asia/Kolkata. Scheduled means a due date is recorded; requested means a service request is linked; confirmed means assigned work has started. Calendar overdue is shown separately. These stages do not book an appointment.</p></div></div>
    {kpis&&<div className="lifecycle-kpis">{Object.entries(kpis).filter(([key])=>key!=="expiryWindowDays").map(([key,value])=><Link href={key==="pending"?"/admin/service-requests?status=pending":key==="inProgress"?"/admin/service-requests?status=in_progress":base+"?view="+(key==="pendingRenewals"?"renewals":"maintenanceSchedule")} key={key} className="customer-details-panel"><strong>{value}</strong><span>{{pending:"Pending requests",inProgress:"Work in progress",pendingRenewals:"Pending renewals",overdueVisits:"Overdue maintenance",upcomingVisits:"Upcoming maintenance",expiringPlans:"Expiring managed plans"}[key]}</span></Link>)}</div>}
    {admin&&<p className="muted">Expiry window: {kpis?.expiryWindowDays} days. Maintenance KPIs cover managed periods created after this upgrade; legacy periods remain on appliance pages.</p>}
    <div className="profile-actions">{Object.entries(labels).filter(([key])=>admin||key!=="serviceFollowups").map(([key,label])=><Link key={key} className={"button "+(view===key?"primary":"secondary")} href={base+"?view="+key}>{label}</Link>)}</div>
    <section className="customer-details-panel"><div className="section-heading"><h2>{labels[view]}</h2>{admin&&<a className="text-button" href={"/api/lifecycle/report?view="+view+(search.cursor?"&cursor="+encodeURIComponent(search.cursor):"")}>Download this page as CSV</a>}</div>
      {!items.length&&<p className="muted">No records to display. Existing service plans are preserved on appliance pages.</p>}
      <div className="lifecycle-records">{items.map(item=><article key={String(item.id)}>
        <h3>{String(item.planName??item.name??item.kind??"Service follow-up")}</h3>
        <p>{String(item.customerName??"")} {String(item.applianceLabel??"")}</p>
        <dl className="customer-details">{Object.entries(item).filter(([key])=>Object.hasOwn(fieldLabels,key)).map(([key,value])=><div key={key}><dt>{fieldLabels[key]}</dt><dd>{key==="pricePaise"?"₹"+Number(value)/100:String(value??"—")}</dd></div>)}</dl>
        {view==="maintenanceSchedule"&&<><p>Calendar: <strong>{serviceDueStatus({status:String(item.status),dueOn:String(item.dueOn),expiresOn:String(item.expiresOn)},indiaDate())}</strong></p>{!admin&&!item.requestId&&item.status!=="completed"&&String(item.startsOn)<=indiaDate()&&String(item.expiresOn)>=indiaDate()&&<Link className="button secondary" href={"/customer/service-requests/new?applianceId="+item.applianceId+"&serviceType=maintenance&free=1"}>Request free maintenance</Link>}</>}
        {view==="renewals"&&<div className="profile-actions">{!admin&&item.status==="awaiting_customer"&&<><LifecycleButton row={item} action="agree">Agree to renewal — ₹{Number(item.pricePaise)/100}</LifecycleButton><LifecycleButton row={item} action="decline">Decline</LifecycleButton></>}{admin&&item.status==="agreed"&&<LifecycleButton row={item} action="confirm">Confirm renewal</LifecycleButton>}{admin&&["agreed","awaiting_customer"].includes(String(item.status))&&<LifecycleButton row={item} action="cancel">Withdraw proposal</LifecycleButton>}</div>}
        {item.customerId&&item.applianceId&&<p><Link href={admin?"/admin/customers/"+item.customerId+"/appliances/"+item.applianceId:"/customer/appliances/"+item.applianceId}>View appliance and plan history →</Link></p>}
      </article>)}</div>
      <div className="customer-pagination"><span>Up to 50 records per page.</span>{nextCursor&&<Link className="button secondary" href={base+"?view="+view+"&cursor="+nextCursor}>Next page →</Link>}{search.cursor&&<Link href={base+"?view="+view}>First page</Link>}</div>
    </section>
    {packages&&<><RenewalForm customerId={search.customerId!} applianceId={search.applianceId!} packages={packages.items}/>{packages.nextCursor&&<Link href={base+"?customerId="+search.customerId+"&applianceId="+search.applianceId+"&packageCursor="+packages.nextCursor}>More catalogue packages →</Link>}</>}
    {admin&&<FollowupForm requestId={search.requestId}/>}<ConsentForm initial={consent}/>{admin&&<AutomationSettings initial={settings}/>}
  </>;
}
