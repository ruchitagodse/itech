import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getServiceRequest } from "@/lib/service-requests/server";
import { listTechnicians } from "@/lib/assignments/server";
import { canAssignTechnician, type TechnicianDirectory } from "@/lib/assignments/data";
import { getWork } from "@/lib/technician-work/server";
import { WorkNotes } from "@/components/service-requests/work-notes";
import { RequestDetails } from "@/components/service-requests/request-details";
import { serviceTypes } from "@/lib/service-requests/data";
export const metadata = { title: "Service request details" };
export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const profile = await requireRole("admin");
  const item = await getServiceRequest(profile, (await params).id);
  if (!item) notFound();
  const work = await getWork(profile, item.id);
  let technicians: TechnicianDirectory | undefined;
  let technicianError = "";
  if (canAssignTechnician(item.status, item.assignedTechnicianUid)) {
    try { technicians = await listTechnicians(profile); }
    catch { technicianError = "Could not load technicians. Use Load technicians to try again."; }
  }
  return <><Link className="text-button" href="/admin/service-requests">← Service requests</Link><div className="page-heading customer-heading"><div><span className="eyebrow">REQUEST DETAILS</span><h1>{serviceTypes[item.serviceType]} request<span className="welcome-dot">.</span></h1><p className="muted">{item.applianceLabel}</p></div></div>
  {(await searchParams).saved === "1" && <div className="message success customer-success" role="status">Service request submitted successfully.</div>}
  <div className="profile-actions"><Link className="button secondary" href={"/admin/lifecycle?view=serviceFollowups&requestId="+item.id}>Schedule a follow-up</Link></div>
  <RequestDetails item={item} admin={true} initialTechnicians={technicians} technicianError={technicianError} /><WorkNotes work={work} /></>;
}
