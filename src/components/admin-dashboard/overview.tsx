import Link from "next/link";
import type { Profile } from "@/lib/roles";
import type { AdminDashboardData } from "@/lib/admin-dashboard/server";
import { requestStatuses, serviceTypes } from "@/lib/service-requests/data";
import { Icon, type IconName } from "./icons";
import s from "./dashboard.module.css";
const number = (n: number | null) => n === null ? "—" : n.toLocaleString("en-IN");
function date(value: unknown, time = false) {
  const raw = value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate() : new Date(String(value).length === 10 ? value + "T00:00:00+05:30" : String(value));
  return Number.isNaN(raw.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "numeric", minute: "2-digit" } : {}) }).format(raw);
}
function SectionHeading({ icon, title, sub, href, action }: { icon: IconName; title: string; sub?: string; href?: string; action?: string }) {
  return <div className={s.sectionHeading}><div><h2><Icon name={icon}/>{title}</h2>{sub && <p>{sub}</p>}</div>{href && <Link className={s.textLink} href={href}>{action ?? "View all"}</Link>}</div>;
}
function Empty({ failed, text }: { failed: boolean; text: string }) { return <div className={s.empty}><Icon name={failed ? "clock" : "check"}/><strong>{failed ? "Unable to load this section" : text}</strong><p>{failed ? "Refresh the page to try again. Other sections may still be available." : "New records will appear here as your team works."}</p></div>; }
export function AdminOverview({ profile, data: d }: { profile: Profile; data: AdminDashboardData }) {
  const stats: { title: string; value: number | null; icon: IconName; note: string; href?: string }[] = [
    { title: "Total customers", value: d.customers, icon: "customers", note: "Customer records", href: "/admin/customers" },
    { title: "Total technicians", value: d.technicians, icon: "team", note: "Registered technician accounts" },
    { title: "Registered appliances", value: d.appliances, icon: "appliance", note: "Across all customers", href: "/admin/customers" },
    { title: "Active service plans", value: d.activePlans, icon: "plan", note: "Valid plans with visits remaining", href: "/admin/customers" },
  ];
  const actions: { title: string; note: string; href: string; icon: IconName }[] = [
    { title: "Add customer", note: "Create a customer record", href: "/admin/customers/new", icon: "customers" },
    { title: "Add technician", note: "Create a technician account", href: "/admin/accounts/new", icon: "team" },
    { title: "Register appliance", note: "Choose a customer to begin", href: "/admin/customers", icon: "appliance" },
    { title: "Create service request", note: "Choose customer & appliance", href: "/admin/customers", icon: "request" },
    { title: "Manage service plans", note: "Open a customer’s appliance", href: "/admin/customers", icon: "plan" },
  ];
  const allCounts = Object.values(d.statuses), total = allCounts.every(n => n !== null) ? allCounts.reduce<number>((a, n) => a + (n ?? 0), 0) : null;
  const maintenance = d.maintenance?.filter(r => r.status !== "completed" && String(r.expiresOn) >= d.today).slice(0, 5);
  const unavailable = stats.some(x => x.value === null) || allCounts.some(x => x === null) || d.assigned === null || d.expiring === null || d.expired === null || d.awaitingAdmin === null || d.awaitingCustomer === null;
  return <div className={s.dashboard}>
    <div className={s.pageHeading}><div><p className={s.eyebrow}>YOUR BUSINESS AT A GLANCE</p><h1>Welcome back, {profile.displayName.trim().split(/\s+/)[0]}<span>.</span></h1><p>Here’s what’s happening across your service operations.</p></div><div className={s.date}><Icon name="calendar"/><div><strong>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(d.today + "T00:00:00+05:30"))}</strong><small>Business date · India Standard Time</small></div></div></div>
    {unavailable && <div className={s.warning} role="status">Some business metrics could not be loaded. “—” means unavailable. Refresh to try again.</div>}
    <div className={s.overviewHeading}><h2>Business overview</h2><span>Current records · refreshed on page load</span></div>
    <section className={s.kpis} aria-label="Business overview">{stats.map(x => { const content = <><div className={s.kpiTop}><span>{x.title}</span><span className={s.iconTile}><Icon name={x.icon}/></span></div><strong className={s.kpiValue}>{number(x.value)}</strong><p>{x.note}</p></>; return x.href ? <Link key={x.title} className={s.kpi} href={x.href}>{content}</Link> : <article className={s.kpi} key={x.title}>{content}</article>; })}</section>
    <div className={s.primaryGrid}><section className={s.panel}><SectionHeading icon="request" title="Service requests" sub="A clear view of your service pipeline" href="/admin/service-requests" action="All requests"/>
      <div className={s.pipeline}>{Object.entries(requestStatuses).map(([key, label]) => <Link className={s.statusCard} key={key} href={"/admin/service-requests?status=" + key}><span className={`${s.statusLabel} ${s[key]}`}><i/>{label}</span><strong>{number(d.statuses[key])}</strong><small>{key === "pending" ? "Awaiting service" : key === "in_progress" ? "Work underway" : key === "completed" ? "Service delivered" : "Closed without service"}</small></Link>)}</div>
      <div className={s.pipelineBar} aria-hidden="true">{total !== null && total > 0 ? Object.keys(requestStatuses).map(key => <span className={s[key]} key={key} style={{ width: `${(d.statuses[key] ?? 0) / total * 100}%` }}/>) : <span/>}</div>
      <div className={s.pipelineFoot}><span><strong>{number(d.assigned)}</strong> assigned within pending requests</span><Link href="/admin/service-requests?status=pending">Open pending queue</Link></div>
      <p className={s.caption}>Assignment is separate from request status. Counts cover all recorded requests.</p>
    </section><section className={s.quickPanel}><SectionHeading icon="plus" title="Quick actions" sub="Keep your operations moving"/><div className={s.quickActions}>{actions.map(a => <Link href={a.href} key={a.title}><span className={s.actionIcon}><Icon name={a.icon}/></span><span><strong>{a.title}</strong><small>{a.note}</small></span><Icon name="plus"/></Link>)}</div></section></div>
    <section className={s.panel}><SectionHeading icon="calendar" title="Upcoming maintenance" sub="Next due dates · these are not confirmed appointments" href="/admin/lifecycle?view=maintenanceSchedule" action="Service calendar"/>
      {!maintenance?.length ? <Empty failed={maintenance === undefined} text="No upcoming maintenance due"/> : <div className={s.schedule}><div className={s.tableHead}><span>Customer & appliance</span><span>Service</span><span>Scheduled due date</span><span>Visit stage</span><span/></div>{maintenance.map(r => <div className={s.scheduleRow} key={r.id}><div><strong>{String(r.customerName ?? "Customer")}</strong><small>{String(r.applianceLabel ?? "Appliance")}</small></div><div><strong>Maintenance</strong><small>{String(r.planName ?? "Service plan")}</small></div><div><strong>{date(r.dueOn)}</strong><small>Due date · IST</small></div><span className={s.badge}>{String(r.workflowStatus ?? "scheduled").replaceAll("_", " ")}</span><Link className={s.textLink} href={r.customerId && r.applianceId ? `/admin/customers/${encodeURIComponent(String(r.customerId))}/appliances/${encodeURIComponent(String(r.applianceId))}` : "/admin/lifecycle?view=maintenanceSchedule"}>View record</Link></div>)}</div>}
      <p className={s.panelNote}>Next 5 scheduled maintenance visits. Managed periods only; legacy plans remain on appliance pages.</p>
    </section>
    <div className={s.secondaryGrid}><section className={s.panel}><SectionHeading icon="plan" title="Renewal management" sub="Keep customer coverage moving forward" href="/admin/lifecycle?view=renewals" action="Manage renewals"/><div className={s.renewalGrid}><Link href="/admin/customers"><span>Approaching expiry</span><strong>{number(d.expiring)}</strong><small>Current plan periods · next {d.leadDays} days</small></Link><Link href="/admin/customers"><span>Expired plan periods</span><strong>{number(d.expired)}</strong><small>All historical expired periods</small></Link></div><div className={s.renewalLine}><span className={`${s.roundIcon} ${s.pending}`}><Icon name="clock"/></span><div><strong>Awaiting customer agreement</strong><small>Proposal sent · customer decision pending</small></div><strong>{number(d.awaitingCustomer)}</strong></div><div className={s.renewalLine}><span className={`${s.roundIcon} ${s.completed}`}><Icon name="check"/></span><div><strong>Awaiting Admin confirmation</strong><small>Customer agreed · ready for review</small></div><strong>{number(d.awaitingAdmin)}</strong></div><p className={s.panelNote}>Review and confirm renewals in the existing renewal workflow. Open a customer’s appliance for plan history.</p></section>
      <section className={s.panel}><SectionHeading icon="clock" title="Recent activity" sub="Latest recorded service events"/>{!d.events?.length ? <Empty failed={d.events === null} text="No service events recorded yet"/> : <div className={s.activity}>{d.events.map((e, i) => <Link key={i} href={e.requestId ? "/admin/service-requests/" + encodeURIComponent(String(e.requestId)) : "/admin/service-requests"}><span className={s.activityDot}/><div><strong>{String(e.eventLabel ?? "Service updated").replaceAll("_", " ")}</strong><small>{String(serviceTypes[e.serviceType as keyof typeof serviceTypes] ?? "Service request")} · {date(e.createdAt, true)}</small></div><span className={s.eventTag}>Service</span></Link>)}</div>}</section></div>
    <section className={s.panel}><SectionHeading icon="request" title="Latest service requests" sub="Most recently created requests" href="/admin/service-requests"/>{!d.recent?.length ? <Empty failed={d.recent === null} text="No service requests yet"/> : <div className={s.recentRequests}>{d.recent.map(r => <Link href={"/admin/service-requests/" + r.id} key={r.id}><div><strong>{String(r.customerName ?? "Customer")}</strong><small>{String(r.applianceLabel ?? "Appliance")} · {String(serviceTypes[r.serviceType as keyof typeof serviceTypes] ?? "Service")}</small></div><span className={`${s.badge} ${s[String(r.status)] ?? ""}`}>{requestStatuses[r.status as keyof typeof requestStatuses] ?? "Unknown status"}</span><span className={s.requestDate}>{date(r.createdAt)}</span></Link>)}</div>}</section>
  </div>;
}


