import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listAppliancePlans } from "@/lib/service-plans/server";
import { PlanForm } from "@/components/service-plans/plan-form";
export const metadata = { title: "Appliance service plan" };
export default async function NewPlanPage({ params }: { params: Promise<{ id: string; applianceId: string }> }) {
  const profile = await requireRole("admin"), { id,applianceId } = await params;
  const { appliance,latest } = await listAppliancePlans(profile,id,applianceId);
  const base = "/admin/customers/" + id + "/appliances/" + applianceId;
  return <><Link className="text-button" href={base}>← Appliance details</Link><div className="page-heading customer-heading"><div><h1>{latest ? "Renew service plan" : "Add service plan"}<span className="welcome-dot">.</span></h1><p className="muted">{appliance.brand} {appliance.model}</p></div></div><PlanForm customerId={id} applianceId={applianceId} applianceType={appliance.type} installationDate={appliance.installationDate} latest={latest} /></>;
}
