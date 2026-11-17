import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCustomer } from "@/lib/customers/server";
import { getAppliance } from "@/lib/appliances/server";
import { ApplianceForm } from "@/components/appliances/appliance-form";
export const metadata = { title: "Edit appliance" };
export default async function EditAppliancePage({ params }: { params: Promise<{ id: string; applianceId: string }> }) {
  const profile = await requireRole("admin");
  const { id, applianceId } = await params;
  const customer = await getCustomer(profile, id);
  const appliance = await getAppliance(profile, id, applianceId);
  if (!customer || !appliance) notFound();
  return <><div className="page-heading"><div><span className="eyebrow">APPLIANCE MANAGEMENT</span><h1>Edit appliance<span className="welcome-dot">.</span></h1><p className="muted">Update this appliance’s details and record status.</p></div></div><ApplianceForm customerId={id} customerName={customer.fullName} appliance={appliance} /></>;
}
