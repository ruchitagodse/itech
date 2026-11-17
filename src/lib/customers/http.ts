import "server-only";
import { NextResponse } from "next/server";
import { CustomerAccessError, CustomerStoreError } from "./server";
export function customerError(error: unknown) {
  if (error instanceof CustomerAccessError) {
    const messages: Record<number, string> = { 400: "Invalid customer request.", 403: "Customer access denied.", 404: "Customer not found.", 409: "This email belongs to an account that is not a Customer.", 413: "Request is too large." };
    return NextResponse.json({ error: messages[error.status] ?? "Customer access denied." }, { status: error.status });
  }
  if (error instanceof CustomerStoreError) {
    const duplicates: Record<string, string> = {
      "duplicate-email": "A customer with this email already exists.",
      "duplicate-phone": "A customer with this phone number already exists.",
      "duplicate-owner": "This Customer account is already linked to a customer record.",
    };
    const message = duplicates[error.code];
    return NextResponse.json({ error: message ?? "Could not save the customer." }, { status: message ? 409 : error.code === "not-found" ? 404 : error.code === "forbidden" ? 403 : 503 });
  }
  return NextResponse.json({ error: "Customer information is unavailable. Please try again or contact your administrator." }, { status: 503 });
}
export async function customerBody(request: Request) {
  const text = await request.text();
  if (text.length > 12000) throw new CustomerAccessError(413);
  try { return JSON.parse(text); } catch { throw new CustomerAccessError(400); }
}
