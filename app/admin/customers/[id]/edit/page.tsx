import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCustomer } from "@/lib/customers/server";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/admin-customers/shared";
import Link from "next/link";
import s from "@/components/admin-customers/customers.module.css";
export const metadata = { title: "Edit customer" };
export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const customer = await getCustomer(profile, (await params).id);
  if (!customer) notFound();
  return <div className={s.screen}><Link className={s.backLink} href={"/admin/customers/" + customer.id}>Customer profile</Link><PageHeader title="Edit customer" subtitle={"Update contact details and record status for " + customer.fullName + "."}/><CustomerForm customer={customer}/></div>;
}
