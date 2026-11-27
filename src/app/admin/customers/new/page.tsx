import { requireRole } from "@/lib/auth";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/admin-customers/shared";
import Link from "next/link";
import s from "@/components/admin-customers/customers.module.css";
export const metadata = { title: "Add customer" };
export default async function AddCustomerPage() {
  await requireRole("admin");
  return <div className={s.screen}><Link className={s.backLink} href="/admin/customers">All customers</Link><PageHeader title="Add customer" subtitle="Create a customer record and start a lasting service relationship."/><CustomerForm/></div>;
}
