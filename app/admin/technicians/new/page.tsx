import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { TechnicianCreateForm } from "@/components/admin-technicians/create-form";
import c from "@/components/admin-customers/customers.module.css";
export const metadata = { title: "Add technician" };
export default async function NewTechnicianPage() {
  await requireRole("admin");
  return <div className={c.screen}><Link className={c.backLink} href="/admin/technicians">All technicians</Link><div className={c.pageHeading}><div><p className={c.eyebrow}>TEAM MANAGEMENT</p><h1>Add technician<span>.</span></h1><p>Bring a new team member into your service workspace.</p></div></div><TechnicianCreateForm/></div>;
}
