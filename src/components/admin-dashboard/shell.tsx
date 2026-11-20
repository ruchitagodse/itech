"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";
import { Icon, type IconName } from "./icons";
import s from "./dashboard.module.css";
const groups: { label: string; links: { href: string; label: string; icon: IconName }[] }[] = [
  { label: "WORKSPACE", links: [{ href: "/admin", label: "Dashboard", icon: "overview" }, { href: "/admin/service-requests", label: "Service requests", icon: "request" }, { href: "/admin/customers", label: "Customers", icon: "customers" }, { href: "/admin/appliances", label: "Appliances", icon: "appliance" }] },
  { label: "MANAGEMENT", links: [{ href: "/admin/technicians", label: "Technicians", icon: "team" }, { href: "/admin/service-packages", label: "Service packages", icon: "plan" }, { href: "/admin/lifecycle", label: "Maintenance & renewals", icon: "calendar" }, { href: "/admin/accounts/new", label: "Create account", icon: "team" }] },
];
export function AdminShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname(), [collapsed, setCollapsed] = useState(false), drawer = useRef<HTMLDialogElement>(null), menu = useRef<HTMLButtonElement>(null);
  useEffect(() => { drawer.current?.close(); }, [pathname]);
  const title = pathname === "/admin" ? "Dashboard" : pathname.includes("/appliances") ? "Appliances" : groups.flatMap(g => g.links).find(l => pathname.startsWith(l.href) && l.href !== "/admin")?.label ?? "Admin workspace";
  const navigation = <>{groups.map(g => <div className={s.navGroup} key={g.label}><p className={s.groupLabel}>{g.label}</p>{g.links.map(l => {
    const active = pathname === l.href || l.href !== "/admin" && pathname.startsWith(l.href + "/");
    return <Link href={l.href} key={l.href} className={active ? s.active : ""} aria-current={active ? "page" : undefined} title={l.label} onClick={() => drawer.current?.close()}><Icon name={l.icon}/><span>{l.label}</span></Link>;
  })}</div>)}</>;
  const identity = <div className={s.identity}><span className={s.avatar}>{profile.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{profile.displayName}</strong><small>Administrator</small></div></div>;
  const logo = <Link href="/admin" aria-label="iTech Admin dashboard" className={s.logo}><Image src="/itech-logo.jpeg" alt="iTech" width={156} height={77} priority style={{ objectFit: "contain" }}/></Link>;
  return <div className={`${s.frame} ${collapsed ? s.collapsed : ""}`}>
    <aside className={s.sidebar}>{logo}<div className={s.workspaceTag}>ADMIN WORKSPACE</div><nav aria-label="Admin navigation">{navigation}</nav><div className={s.sideBottom}><div className={s.careNote}><Icon name="plan"/><strong>Care, connected.</strong><p>Your service operations,<br/>all in one place.</p></div>{identity}<LogoutButton/></div><button className={s.collapseButton} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)}><Icon name="collapse"/></button></aside>
    <div className={s.body}><header className={s.topbar}><button ref={menu} className={`${s.iconButton} ${s.mobileMenu}`} aria-label="Open navigation" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Icon name="menu"/></button><div className={s.breadcrumb}>Workspace <span>/</span> <strong>{title}</strong></div><div className={s.headerRight}><Link href="/admin/lifecycle?view=notifications" className={s.iconButton} aria-label="Notification history"><Icon name="bell"/></Link><span className={s.headerDivider}/>{identity}</div></header><main id="main" className={s.main}>{children}</main><footer className={s.footer}><span>iTech V2 · Service operations</span><span>Care, connected.</span></footer></div>
    <dialog ref={drawer} className={s.drawer} aria-label="Admin navigation" onClose={() => menu.current?.focus()} onClick={e => { if (e.target === drawer.current) drawer.current.close(); }}><div className={s.drawerContent}><div className={s.drawerHeading}>{logo}<button className={s.iconButton} aria-label="Close navigation" onClick={() => drawer.current?.close()}><Icon name="close"/></button></div><nav aria-label="Mobile admin navigation">{navigation}</nav><div className={s.sideBottom}>{identity}<LogoutButton/></div></div></dialog>
  </div>;
}

