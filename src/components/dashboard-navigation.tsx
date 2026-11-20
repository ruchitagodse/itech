"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";
export function DashboardNavigation({ role }: { role: Role }) {
  const pathname = usePathname();
  const links = [{ href: "/" + role, label: "Overview", icon: "▦" }];
  if (role === "admin") links.push({ href: "/admin/customers", label: "Customers", icon: "◈" }, { href: "/admin/appliances", label: "Appliances", icon: "⚙" }, { href: "/admin/accounts/new", label: "Create account", icon: "+" }, { href: "/admin/service-requests", label: "Service requests", icon: "◷" }, { href: "/admin/service-packages", label: "Service packages", icon: "◇" });
  if (role === "technician") links.push({ href: "/technician/assignments", label: "My assigned work", icon: "◷" });
  if (role === "customer") links.push({ href: "/customer/profile", label: "My profile", icon: "◈" }, { href: "/customer/appliances", label: "My appliances", icon: "◇" }, { href: "/customer/service-requests", label: "My services", icon: "◷" }, { href: "/customer/service-packages", label: "Service catalogue", icon: "▦" }, { href: "/customer/service-plans", label: "My service plans", icon: "◈" });
  if (role === "admin" || role === "customer") links.push({ href: "/" + role + "/lifecycle", label: role === "admin" ? "Service lifecycle" : "Care & renewals", icon: "◷" });
  return <nav aria-label="Main navigation">{links.map(link => {
    const active = pathname === link.href || (link.href === "/admin/appliances" && pathname.startsWith("/admin/appliances")) || (link.href.endsWith("/service-packages") && pathname.startsWith(link.href + "/")) || (link.href === "/technician/assignments" && pathname.startsWith(link.href + "/")) || (link.href.endsWith("/service-requests") && pathname.startsWith(link.href + "/")) || (link.href === "/admin/customers" && pathname.startsWith("/admin/customers/")) || (link.href === "/customer/appliances" && pathname.startsWith("/customer/appliances/"));
    return <Link key={link.href} className={"nav-link" + (active ? " active" : "")} href={link.href} aria-current={active ? "page" : undefined}><span aria-hidden="true">{link.icon}</span>{link.label}</Link>;
  })}</nav>;
}
export function WorkspaceTitle() {
  const pathname = usePathname();
  return <strong>{pathname.includes("/lifecycle") ? "Service lifecycle" : pathname === "/customer/service-plans" ? "My service plans" : pathname.includes("/service-packages") ? "Service packages" : pathname.startsWith("/technician/assignments") ? "My assigned work" : pathname.includes("/service-requests") ? "Service requests" : pathname.includes("/appliances") ? "Appliances" : pathname.startsWith("/admin/customers") ? "Customers" : pathname === "/customer/profile" ? "My profile" : pathname === "/admin/accounts/new" ? "Create account" : "Overview"}</strong>;
}
