"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Profile } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";
import { Icon, type IconName } from "./icons";
import s from "./dashboard.module.css";
import { WorkspaceNavigation, workspaceLinks } from "@/components/ui/workspace-navigation";
export function WorkspaceShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname(), [collapsed, setCollapsed] = useState(false);
  const role = profile.role;
  const roleLabel = role === "admin" ? "Administrator" : "Technician";
  const groups: { label: string; links: { href: string; label: string; icon: IconName }[] }[] = role === "admin"
    ? [{ label: "WORKSPACE", links: workspaceLinks.admin.slice(0, 4) }, { label: "MANAGEMENT", links: workspaceLinks.admin.slice(4) }]
    : [{ label: "YOUR WORKSPACE", links: workspaceLinks.technician }];
  const title = pathname === "/" + role ? "Overview" : pathname.includes("/appliances") ? "Appliances" : groups.flatMap(g => g.links).find(l => pathname.startsWith(l.href) && l.href !== "/" + role)?.label ?? roleLabel + " workspace";
  const navigation = <>{groups.map(g => <div className={s.navGroup} key={g.label}><p className={s.groupLabel}>{g.label}</p>{g.links.map(l => {
    const active = pathname === l.href || l.href !== "/" + role && pathname.startsWith(l.href + "/");
    return <Link href={l.href} key={l.href} className={active ? s.active : ""} aria-current={active ? "page" : undefined} title={l.label}><Icon name={l.icon}/><span>{l.label}</span></Link>;
  })}</div>)}</>;
  const identity = <div className={s.identity}><span className={s.avatar}>{profile.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{profile.displayName}</strong><small>{roleLabel}</small></div></div>;
  const logo = <Link href={"/" + role} aria-label={"iTech " + roleLabel + " dashboard"} className={s.logo}><Image src="/itech-logo.jpeg" alt="iTech" width={156} height={77} priority style={{ objectFit: "contain" }}/></Link>;
  return <div className={`${s.frame} ${collapsed ? s.collapsed : ""}`}>
    <aside className={s.sidebar}>{logo}<div className={s.workspaceTag}>{roleLabel.toUpperCase()} WORKSPACE</div><nav aria-label={roleLabel + " navigation"}>{navigation}</nav><div className={s.sideBottom}><div className={s.careNote}><Icon name="plan"/><strong>Care, connected.</strong><p>{role === "admin" ? "Your service operations, all in one place." : "Your assigned work, always within reach."}</p></div>{identity}<LogoutButton/></div><button className={s.collapseButton} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)}><Icon name="collapse"/></button></aside>
    <div className={s.body}><header className={s.topbar}><WorkspaceNavigation role={role}/><div className={s.breadcrumb}><small className={s.mobileWordmark}>iTech Care</small>Workspace <span>/</span> <strong>{title}</strong></div><div className={s.headerRight}>{role === "admin" && <Link href="/admin/lifecycle?view=notifications" className={s.iconButton} aria-label="Notification history"><Icon name="bell"/></Link>}<span className={s.headerDivider}/>{identity}</div></header><main id="main" tabIndex={-1} className={s.main}>{children}</main><footer className={s.footer}><span>iTech V2 · Service operations</span><span>Care, connected.</span></footer></div>
  </div>;
}


export const AdminShell = WorkspaceShell;
