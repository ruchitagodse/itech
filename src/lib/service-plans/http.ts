import "server-only";
import { NextResponse } from "next/server";
import { PlanStoreError } from "./server";
import { CustomerAccessError } from "@/lib/customers/server";
export function planError(error: unknown) {
  if (error instanceof CustomerAccessError) return NextResponse.json({ error: "Plan access denied." }, { status: error.status });
  if (error instanceof PlanStoreError) {
    const errors: Record<string, [number, string]> = { "schedule-conflict": [409,"Plan validity must cover both included visits at the configured frequency. Historical schedules have not been changed."], "approval-required": [409,"Use Service lifecycle to propose a renewal for Customer agreement."], "policy-required": [409,"Choose a package with configured validity and maintenance interval."], "installation-required": [409,"Record the actual installation date before creating a plan."], invalid: [400,"Check the plan name and valid dates."], forbidden: [403,"Plan access denied."], "not-found": [404,"Appliance not found."], inactive: [409,"Plans require an active customer and appliance."], conflict: [409,"The latest plan changed. Refresh before saving."], overlap: [409,"A renewal must start after the latest plan expires."], "package-unavailable": [409,"Choose an active maintenance package for this appliance type, or use the included-care option."] };
    const [status,message] = errors[error.code] ?? [503,"Plans are unavailable. Please try again."];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ error: "Plans are unavailable. Please try again." }, { status: 503 });
}
