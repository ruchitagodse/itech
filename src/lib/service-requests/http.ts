import "server-only";
import { NextResponse } from "next/server";
import { ServiceRequestError } from "./server";
import { CustomerAccessError } from "@/lib/customers/server";
export function serviceRequestError(error: unknown) {
  if (error instanceof CustomerAccessError) return NextResponse.json({ error: "Request access denied." }, { status: error.status });
  if (error instanceof ServiceRequestError) {
    const errors: Record<string, [number, string]> = {
      "technician-unavailable": [409, "Choose an active, enabled and email-verified Technician."],
      "plan-unavailable": [409, "No free maintenance visit is currently available for this appliance. The plan may have expired, not started or been fully used."],
      "linkage-review-required": [409, "This maintenance request needs an administrator review of its plan and visit linkage before completion. Existing records have not been changed."],
      "notes-required": [400, "Add service notes before completing work."],
      "assignment-required": [409, "Assign a technician before starting or completing this request."],
      "assignment-closed": [409, "Assignments can change while Pending, or to repair an unassigned In-progress request."],
      "assignment-unchanged": [409, "Choose a different technician or leave this request unchanged."],
      forbidden: [403, "Request access denied."], "not-found": [404, "Request or appliance not found."],
      invalid: [400, "Check the request details."], inactive: [409, "New requests require an active customer and appliance. Contact your administrator."],
      duplicate: [409, "An open request of this service type already exists for this appliance."],
      conflict: [409, "This request changed. Refresh before trying again."], transition: [409, "This status change is not allowed."],
    };
    const [status, message] = errors[error.code] ?? [503, "Service requests are unavailable. Please try again."];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ error: "Service requests are unavailable. Please try again." }, { status: 503 });
}
