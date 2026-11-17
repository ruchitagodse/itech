import "server-only";
import { NextResponse } from "next/server";
import { PackageStoreError } from "./server";
import { CustomerAccessError } from "@/lib/customers/server";
export function packageError(error: unknown) {
  if (error instanceof CustomerAccessError) return NextResponse.json({ error: "Invalid package request." }, { status: error.status });
  if (error instanceof PackageStoreError) {
    const errors: Record<string, [number, string]> = { "schedule-conflict": [409, "Plan validity must cover both visits at the configured frequency."], invalid: [400, "Check the package details."], forbidden: [403, "Package access denied."], "not-found": [404, "Package not found."], conflict: [409, "This package changed. Refresh before saving."] };
    const [status,message] = errors[error.code] ?? [503,"Packages are unavailable. Please try again."];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ error: "Packages are unavailable. Please try again." }, { status: 503 });
}
