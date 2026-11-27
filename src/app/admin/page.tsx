import { requireRole } from "@/lib/auth";
import { adminDashboard } from "@/lib/admin-dashboard/server";
import { AdminOverview } from "@/components/admin-dashboard/overview";
export const metadata = { title: "Admin dashboard" };
export default async function Page() {
  const profile = await requireRole("admin");
  return <AdminOverview profile={profile} data={await adminDashboard(profile)}/>;
}
