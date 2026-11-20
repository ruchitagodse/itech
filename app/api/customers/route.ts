import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { validateCustomer } from "@/lib/customers/data";
import { listCustomers, persistCustomer } from "@/lib/customers/server";
import { customerBody, customerError } from "@/lib/customers/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    return NextResponse.json(await listCustomers(profile, params.get("q") ?? "", params.get("cursor") ?? ""), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerError(error); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const { data, errors } = validateCustomer(await customerBody(request));
    if (!data) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    return NextResponse.json({ id: await persistCustomer(profile, data) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerError(error); }
}
