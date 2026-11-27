import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCustomer } from "@/lib/customers/server";
import { AdminApplianceForm } from "@/components/admin-appliances/form";

export const metadata = {
  title: "Add Customer Appliance | iTech Admin",
};

export default async function AddCustomerAppliancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole("admin");
  const { id } = await params;
  const customer = await getCustomer(profile, id);
  if (!customer) notFound();

  return <AdminApplianceForm customerId={customer.id} customerName={customer.fullName} />;
}
