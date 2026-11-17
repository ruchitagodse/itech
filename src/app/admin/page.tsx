import { requireRole } from "@/lib/auth";
import { DashboardOverview } from "@/components/dashboard-overview";
export const metadata = { title: "Admin overview" };
export default async function Page() { const profile = await requireRole("admin"); return <DashboardOverview profile={profile} />; }
