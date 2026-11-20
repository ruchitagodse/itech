import { requireRole } from "@/lib/auth";
import { technicianDirectory } from "@/lib/admin-technicians/server";
import { TechnicianDirectory } from "@/components/admin-technicians/directory";
export const metadata = { title: "Technicians" };
export default async function TechniciansPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; workload?: string; cursor?: string }> }) {
  const profile = await requireRole("admin");
  return <TechnicianDirectory data={await technicianDirectory(profile, await searchParams)}/>;
}
