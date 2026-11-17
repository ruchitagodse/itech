import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
export const runtime = "nodejs";
export default async function Layout({ children }: { children: React.ReactNode }) {
 const profile = await requireRole("admin");
 return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
