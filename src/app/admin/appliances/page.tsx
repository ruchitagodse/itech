import { requireRole } from "@/lib/auth";
import { adminApplianceInventory } from "@/lib/admin-appliances/server";
import { ApplianceInventory } from "@/components/admin-appliances/inventory";

export const metadata = {
  title: "Appliance Management | iTech Admin",
};

export default async function AdminAppliancesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; coverage?: string; cursor?: string }>;
}) {
  const profile = await requireRole("admin");
  const params = await searchParams;
  const data = await adminApplianceInventory(profile, params);

  return <ApplianceInventory data={data} />;
}
