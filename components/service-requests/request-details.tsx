import Link from "next/link";
import { serviceTypes, requestStatuses, type ServiceRequestRecord } from "@/lib/service-requests/data";
import { canAssignTechnician, type TechnicianDirectory } from "@/lib/assignments/data";
import { AssignmentForm } from "./assignment-form";
import { RequestStatusForm } from "./request-status-form";
export function RequestDetails({ item, admin, technician = false, initialTechnicians, technicianError }: { item: ServiceRequestRecord; admin: boolean; technician?: boolean; initialTechnicians?: TechnicianDirectory; technicianError?: string }) {
  const date = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  return <><section className="customer-details-panel"><dl className="customer-details appliance-details">
    <div><dt>Request ID</dt><dd>{item.id}</dd></div><div><dt>Status</dt><dd><span className={"request-status status-" + item.status}>{requestStatuses[item.status]}</span></dd></div>
    <div><dt>Service type</dt><dd>{serviceTypes[item.serviceType]}</dd></div><div><dt>Customer at time of request</dt><dd>{item.customerName}</dd></div>
    <div><dt>Appliance at time of request</dt><dd>{item.applianceLabel}</dd></div>{!technician && <div><dt>Appliance details</dt><dd><Link className="text-button" href={admin ? "/admin/customers/" + item.customerId + "/appliances/" + item.applianceId : "/customer/appliances/" + item.applianceId}>View appliance →</Link></dd></div>}
    <div><dt>Assigned technician</dt><dd>{item.assignedTechnicianName || "Unassigned"}</dd></div><div><dt>Assignment updated (IST)</dt><dd>{item.assignmentUpdatedAt ? date(item.assignmentUpdatedAt) : "Not assigned yet"}</dd></div>
    {item.servicePlanId && <div className="full-width"><dt>Included maintenance plan</dt><dd>{item.servicePlanName} · {item.servicePlanCreditUsed ? "1 included visit used" : item.servicePlanOutcome === "pending" ? "Visit will be used only if maintenance is completed within plan validity" : item.servicePlanOutcome === "expired" ? "Plan expired before completion; no included visit used" : item.servicePlanOutcome === "exhausted" ? "No visits remaining; no included visit used" : "No included visit used"}</dd></div>}
    {item.visitId && <div><dt>Maintenance visit ID</dt><dd>{item.visitId}</dd></div>}
    {item.serviceType === "maintenance" && !item.servicePlanId && !item.schemaVersion && <div className="full-width"><dt>Legacy linkage</dt><dd>Plan and visit linkage require administrator review before completion. No plan has been inferred.</dd></div>}
    <div className="full-width"><dt>Description</dt><dd>{item.description}</dd></div><div><dt>Created (IST)</dt><dd>{date(item.createdAt)}</dd></div><div><dt>Last updated (IST)</dt><dd>{date(item.updatedAt)}</dd></div>
  </dl></section>{admin && canAssignTechnician(item.status, item.assignedTechnicianUid) && <AssignmentForm item={item} initialTechnicians={initialTechnicians} initialError={technicianError} />}{admin && <RequestStatusForm key={item.status} id={item.id} status={item.status} assignedTechnicianUid={item.assignedTechnicianUid} />}</>;
}
