import "server-only";
import { NextResponse } from "next/server";
import { ApplianceStoreError } from "./server";
import { customerError } from "@/lib/customers/http";
export function applianceError(error: unknown) {
  if (error instanceof ApplianceStoreError) {
    const status = error.code === "duplicate-serial" ? 409 : error.code === "not-found" ? 404 : error.code === "forbidden" ? 403 : 503;
    const message = status === 409 ? "An appliance with this brand and serial number already exists." : status === 404 ? "Customer or appliance not found." : status === 403 ? "Admin access required." : "Could not save the appliance.";
    return NextResponse.json({ error: message }, { status });
  }
  return customerError(error);
}
