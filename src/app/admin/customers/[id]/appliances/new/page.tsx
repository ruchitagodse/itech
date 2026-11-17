import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCustomer } from "@/lib/customers/server";
import { ApplianceForm } from "@/components/appliances/appliance-form";
export const metadata = { title: "Add appliance" };
export default async function AddAppliancePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const customer = await getCustomer(profile, (await params).id);
  if (!customer) notFound();
  return <><div className="page-heading"><div><span className="eyebrow">APPLIANCE MANAGEMENT</span><h1>Add appliance<span className="welcome-dot">.</span></h1><p className="muted">Record a water purifier or air conditioner for this customer.</p></div></div><ApplianceForm customerId={customer.id} customerName={customer.fullName} /></>;
}
