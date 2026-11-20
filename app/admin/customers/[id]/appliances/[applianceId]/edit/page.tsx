import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCustomer } from "@/lib/customers/server";
import { getAppliance } from "@/lib/appliances/server";
import { AdminApplianceForm } from "@/components/admin-appliances/form";

export const metadata = {
  title: "Edit Appliance | iTech Admin",
};

export default async function EditAppliancePage({
  params,
}: {
  params: Promise<{ id: string; applianceId: string }>;
}) {
  const profile = await requireRole("admin");
  const { id, applianceId } = await params;
  const customer = await getCustomer(profile, id);
  const appliance = await getAppliance(profile, id, applianceId);
  if (!customer || !appliance) {
    notFound();
  }

  return (
    <AdminApplianceForm
      customerId={id}
      customerName={customer.fullName}
      appliance={appliance}
    />
  );
}
