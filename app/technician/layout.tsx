import { requireRole } from "@/lib/auth";
import { WorkspaceShell } from "@/components/admin-dashboard/shell";
export const runtime = "nodejs";
export default async function Layout({ children }: { children: React.ReactNode }) {
 const profile = await requireRole("technician");
 return <WorkspaceShell profile={profile}>{children}</WorkspaceShell>;
}
