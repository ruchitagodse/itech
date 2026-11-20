import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getAssignment } from "@/lib/assignments/server";
import { getWork } from "@/lib/technician-work/server";
import { TechnicianWorkForm } from "@/components/service-requests/technician-work-form";
import { WorkNotes } from "@/components/service-requests/work-notes";
import { RequestDetails } from "@/components/service-requests/request-details";
export const metadata = { title: "Assigned request" };
export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("technician");
  const item = await getAssignment(profile, (await params).id);
  if (!item) notFound();
  const work = await getWork(profile, item.id);
  return <><Link className="text-button" href="/technician/assignments">← My assigned work</Link><div className="page-heading customer-heading"><div><span className="eyebrow">ASSIGNED REQUEST</span><h1>Service details<span className="welcome-dot">.</span></h1><p className="muted">Start your assigned job, save notes and complete work.</p></div></div><RequestDetails item={item} admin={false} technician />{item.status === "pending" || item.status === "in_progress" ? <TechnicianWorkForm key={item.status + ":" + work.version} id={item.id} status={item.status} work={work} /> : <WorkNotes work={work} />}</>;
}
