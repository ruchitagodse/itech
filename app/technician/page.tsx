import { requireRole } from "@/lib/auth";
import { TechnicianOverview } from "@/components/technician-overview";
import { listAssignments } from "@/lib/assignments/server";
export const metadata = { title: "Technician overview" };
export default async function Page() {
  const profile = await requireRole("technician");
  const { items } = await listAssignments(profile, "", "");
  return <TechnicianOverview profile={profile} items={items} />;
}
