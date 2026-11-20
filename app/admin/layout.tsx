import { requireRole } from "@/lib/auth";
import { AdminShell } from "@/components/admin-dashboard/shell";
export const runtime = "nodejs";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("admin");
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
