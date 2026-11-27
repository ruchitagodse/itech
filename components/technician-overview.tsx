import Link from "next/link";
import type { Profile } from "@/lib/roles";
import type { ServiceRequestRecord } from "@/lib/service-requests/data";
import { RequestList } from "@/components/service-requests/request-list";
import { Icon } from "@/components/admin-dashboard/icons";
import s from "./technician-overview.module.css";

export function TechnicianOverview({ profile, items }: { profile: Profile; items: ServiceRequestRecord[] }) {
  const active = items.filter(item => item.status === "pending" || item.status === "in_progress");
  return <div className={s.screen}>
    <header className="page-heading"><div><span className="eyebrow">YOUR WORKDAY</span><h1>Hello, {profile.displayName.split(" ")[0]}.</h1><p className="muted">Your assigned services and work updates, together.</p></div></header>
    <section className={s.hero}><span className={s.heroIcon}><Icon name="request" /></span><div><p>READY WHEN YOU ARE</p><h2>Your next service starts here.</h2><p>Open an assignment to review the request, start work and save your service notes.</p><Link className="button primary" href="/technician/assignments">View assigned work <span aria-hidden="true">→</span></Link></div></section>
    <nav className={s.shortcuts} aria-label="Filter assigned work"><Link href="/technician/assignments?status=pending"><Icon name="clock" /><span>Pending work</span><span aria-hidden="true">→</span></Link><Link href="/technician/assignments?status=in_progress"><Icon name="request" /><span>In progress</span><span aria-hidden="true">→</span></Link><Link href="/technician/assignments?status=completed"><Icon name="check" /><span>Completed work</span><span aria-hidden="true">→</span></Link></nav>
    <section><div className={s.sectionHeading}><div><h2>Active assignments</h2><p>Pending and in-progress work from your latest {items.length} assignments.</p></div><Link className="text-button" href="/technician/assignments">View all →</Link></div><RequestList items={active.slice(0, 5)} basePath="/technician/assignments" assignedOnly /></section>
  </div>;
}
