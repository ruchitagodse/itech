"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";
import { Icon, type IconName } from "@/components/admin-dashboard/icons";
import s from "./workspace-navigation.module.css";

type Destination = { href: string; label: string; icon: IconName };
export const workspaceLinks: Record<Role, Destination[]> = {
  admin: [
    { href: "/admin", label: "Overview", icon: "overview" },
    { href: "/admin/service-requests", label: "Service requests", icon: "request" },
    { href: "/admin/customers", label: "Customers", icon: "customers" },
    { href: "/admin/appliances", label: "Appliances", icon: "appliance" },
    { href: "/admin/technicians", label: "Technicians", icon: "team" },
    { href: "/admin/service-packages", label: "Service packages", icon: "plan" },
    { href: "/admin/lifecycle", label: "Maintenance & renewals", icon: "calendar" },
    { href: "/admin/accounts/new", label: "Create account", icon: "plus" },
  ],
  technician: [
    { href: "/technician", label: "Overview", icon: "overview" },
    { href: "/technician/assignments", label: "Assigned work", icon: "request" },
  ],
  customer: [
    { href: "/customer", label: "Home", icon: "overview" },
    { href: "/customer/appliances", label: "Appliances", icon: "appliance" },
    { href: "/customer/service-requests", label: "Requests", icon: "request" },
    { href: "/customer/profile", label: "Profile", icon: "team" },
    { href: "/customer/service-plans", label: "My service plans", icon: "plan" },
    { href: "/customer/service-packages", label: "Service catalogue", icon: "plan" },
    { href: "/customer/lifecycle", label: "Care & renewals", icon: "calendar" },
  ],
};

export function destinationActive(pathname: string, href: string) {
  return pathname === href || (href.split("/").length > 2 && pathname.startsWith(href + "/"));
}

/** Only presents links; each destination retains its existing server authorization. */
export function WorkspaceNavigation({ role }: { role: Role }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const links = workspaceLinks[role];
  const quick = links.slice(0, role === "customer" ? 4 : role === "admin" ? 3 : 2);
  const menuId = `${role}-workspace-menu`;
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  function show(event: React.MouseEvent<HTMLButtonElement>) {
    trigger.current = event.currentTarget;
    setQuery("");
    setOpen(true);
    dialog.current?.showModal();
  }
  function close() { dialog.current?.close(); }
  return <>
    {role !== "customer" && <button type="button" className={s.headerTrigger} onClick={show} aria-label="Open navigation" aria-haspopup="dialog" aria-controls={menuId} aria-expanded={open}><Icon name="menu" /></button>}
    <nav className={s.bottomNav} style={{ "--nav-columns": quick.length + 1 } as React.CSSProperties} aria-label={role === "customer" ? "Customer home navigation" : `${role} quick navigation`}>
      {quick.map(link => <Link key={link.href} href={link.href} aria-current={destinationActive(pathname, link.href) ? "page" : undefined}><Icon name={link.icon} /><span>{link.label === "Service requests" ? "Requests" : link.label === "Assigned work" ? "My work" : link.label}</span></Link>)}
      <button type="button" onClick={show} aria-haspopup="dialog" aria-controls={menuId} aria-expanded={open} data-active={open || !quick.some(link => destinationActive(pathname, link.href))}><Icon name="menu" /><span>More</span></button>
    </nav>
    <dialog ref={dialog} id={menuId} className={s.drawer} aria-labelledby={`${menuId}-title`} onClose={() => {
      setOpen(false);
      if (trigger.current?.getClientRects().length) trigger.current.focus();
      else document.getElementById("main")?.focus();
    }} onClick={event => { if (event.target === dialog.current) close(); }}>
      <div className={s.drawerContent}>
        <header className={s.heading}><div><p>iTech Care</p><h2 id={`${menuId}-title`}>Your workspace</h2></div><button type="button" onClick={close} aria-label="Close navigation"><Icon name="close" /></button></header>
        <label className={s.search}>Find a screen<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your workspace" /></label>
        <nav className={s.destinations} aria-label={`${role} workspace navigation`}>
          {links.filter(link => link.label.toLowerCase().includes(query.trim().toLowerCase())).map(link => <Link href={link.href} key={link.href} onClick={close} aria-current={destinationActive(pathname, link.href) ? "page" : undefined}><Icon name={link.icon} /><span>{link.label}</span></Link>)}
        </nav>
        {!links.some(link => link.label.toLowerCase().includes(query.trim().toLowerCase())) && <p role="status" className={s.noResults}>No matching screens. Try another name.</p>}
        <footer className={s.account}><span>{role === "admin" ? "Administrator" : role === "technician" ? "Technician" : "Customer"} workspace</span><LogoutButton /></footer>
      </div>
    </dialog>
  </>;
}
