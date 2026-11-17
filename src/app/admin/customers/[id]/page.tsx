import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCustomer } from "@/lib/customers/server";
import { CustomerDetails } from "@/components/customers/customer-details";
export const metadata = { title: "Customer details" };
export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;
  const customer = await getCustomer(profile, id);
  if (!customer) notFound();
  return <><Link className="text-button" href="/admin/customers">← All customers</Link><div className="page-heading customer-heading"><div><span className="eyebrow">CUSTOMER DETAILS</span><h1>{customer.fullName}<span className="welcome-dot">.</span></h1><p className="muted">Contact information and customer status.</p></div><Link className="button primary" href={"/admin/customers/" + customer.id + "/edit"}>Edit customer</Link></div>
    {(await searchParams).saved === "1" && <div className="message success customer-success" role="status">Customer saved successfully.</div>}
    <CustomerDetails customer={customer} showLink /><section className="account-panel"><div><span className="account-icon" aria-hidden="true">◇</span><div><h3>Appliances</h3><p>Water purifier and AC records for this customer.</p></div></div><Link className="button secondary" href={"/admin/customers/" + customer.id + "/appliances"}>View appliances</Link></section>
    {!customer.ownerUid && <div className="message customer-success">To give this customer profile access, create a Customer sign-in account with the same email using Create account. Then edit and save this record to link it.</div>}
  </>;
}
