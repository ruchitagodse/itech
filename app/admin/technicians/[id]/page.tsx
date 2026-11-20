import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { technicianDetails, type JobCursors } from "@/lib/admin-technicians/server";
import { TechnicianDetails } from "@/components/admin-technicians/details";
export const metadata = { title: "Technician details" };
export default async function TechnicianPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<JobCursors> }) {
  const profile = await requireRole("admin"), cursors = await searchParams;
  const data = await technicianDetails(profile, (await params).id, cursors);
  if (!data) notFound();
  return <TechnicianDetails data={data} cursors={cursors}/>;
}
