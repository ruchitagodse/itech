import { requireRole } from "@/lib/auth";
import { listCustomersForSelection } from "@/lib/admin-appliances/server";
import { AdminApplianceForm } from "@/components/admin-appliances/form";

export const metadata = {
  title: "Register Appliance | iTech Admin",
};

export default async function AdminNewAppliancePage() {
  const profile = await requireRole("admin");
  const customerList = await listCustomersForSelection(profile);

  return <AdminApplianceForm customerList={customerList} />;
}
