import { requireRole } from "@/lib/auth";
import { CustomerForm } from "@/components/customers/customer-form";
export const metadata = { title: "Add customer" };
export default async function AddCustomerPage() {
  await requireRole("admin");
  return <><div className="page-heading"><div><span className="eyebrow">CUSTOMER MANAGEMENT</span><h1>Add customer<span className="welcome-dot">.</span></h1><p className="muted">Create a customer record with their contact details.</p></div></div><CustomerForm /></>;
}
