import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { CustomerHomeFrame } from "@/components/customer-home/home-frame";
export const runtime = "nodejs";
export default async function Layout({ children }: { children: React.ReactNode }) {
 const profile = await requireRole("customer");
 return <CustomerHomeFrame><DashboardShell profile={profile}>{children}</DashboardShell></CustomerHomeFrame>;
}
