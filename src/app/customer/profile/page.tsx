import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ownCustomer } from "@/lib/customers/server";
import { CustomerDetails } from "@/components/customers/customer-details";
export const metadata = { title: "My profile" };
export default async function MyProfilePage() {
  const profile = await requireRole("customer");
  const customer = await ownCustomer(profile);
  return <><div className="page-heading"><div><span className="eyebrow">YOUR ACCOUNT</span><h1>My profile<span className="welcome-dot">.</span></h1><p className="muted">Your customer details. Contact your administrator to request changes.</p></div></div>
    {customer ? <><CustomerDetails customer={customer} /><div className="profile-actions"><Link className="button secondary" href="/customer/appliances">View my appliances</Link></div></> : <section className="customer-empty"><span className="card-icon" aria-hidden="true">◈</span><h2>Your profile is not linked yet</h2><p className="muted">Ask your administrator to add a customer record using your sign-in email.</p></section>}
  </>;
}
