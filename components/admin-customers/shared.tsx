import Link from "next/link";
import { Icon } from "@/components/admin-dashboard/icons";
import s from "./customers.module.css";
export function CustomerAvatar({ name, large = false }: { name: string; large?: boolean }) {
  return <span className={`${s.avatar} ${large ? s.largeAvatar : ""}`} aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase() || "C"}</span>;
}
export function RecordStatus({ active }: { active: boolean }) { return <span className={`${s.badge} ${active ? s.positive : s.neutral}`}><i/>{active ? "Active" : "Inactive"}</span>; }
export function displayDate(value: string) {
  if (!value) return "Not provided";
  const date = new Date(value.length === 10 ? value + "T00:00:00+05:30" : value);
  return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}
export function PageHeader({ title, subtitle, add = false }: { title: string; subtitle: string; add?: boolean }) {
  return <div className={s.pageHeading}><div><p className={s.eyebrow}>CUSTOMER MANAGEMENT</p><h1>{title}<span>.</span></h1><p>{subtitle}</p></div>{add && <Link className={s.primary} href="/admin/customers/new"><Icon name="plus"/>Add customer</Link>}</div>;
}
export function EmptyState({ title, text }: { title: string; text: string }) { return <div className={s.empty}><span className={s.emptyIcon}><Icon name="customers"/></span><h3>{title}</h3><p>{text}</p></div>; }
