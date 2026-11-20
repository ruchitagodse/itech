import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { adminApplianceDetail } from "@/lib/admin-appliances/server";
import { AdminApplianceDetails } from "@/components/admin-appliances/details";

export const metadata = {
  title: "Appliance Details | iTech Admin",
};

export default async function ApplianceDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; applianceId: string }>;
  searchParams: Promise<{ saved?: string; planSaved?: string }>;
}) {
  const profile = await requireRole("admin");
  const { id, applianceId } = await params;
  const query = await searchParams;

  const detail = await adminApplianceDetail(profile, id, applianceId);
  if (!detail) {
    notFound();
  }

  return (
    <AdminApplianceDetails
      data={detail}
      saved={query.saved === "1"}
      planSaved={query.planSaved === "1"}
    />
  );
}
