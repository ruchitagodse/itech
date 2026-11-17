import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCustomer } from "@/lib/customers/server";
import { CustomerForm } from "@/components/customers/customer-form";
export const metadata = { title: "Edit customer" };
export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const customer = await getCustomer(profile, (await params).id);
  if (!customer) notFound();
  return <><div className="page-heading"><div><span className="eyebrow">CUSTOMER MANAGEMENT</span><h1>Edit customer<span className="welcome-dot">.</span></h1><p className="muted">Update contact details and record status.</p></div></div><CustomerForm customer={customer} /></>;
}
