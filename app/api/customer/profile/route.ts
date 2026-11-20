import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { ownCustomer } from "@/lib/customers/server";
import { customerError } from "@/lib/customers/http";
export const runtime = "nodejs";
export async function GET() {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "customer") return NextResponse.json({ error: "Customer access required." }, { status: 403 });
  try {
    return NextResponse.json({ customer: await ownCustomer(profile) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerError(error); }
}
