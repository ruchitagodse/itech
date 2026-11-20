import { requireRole } from "@/lib/auth";
import { DashboardOverview } from "@/components/dashboard-overview";
export const metadata = { title: "Technician overview" };
export default async function Page() { const profile = await requireRole("technician"); return <DashboardOverview profile={profile} />; }
