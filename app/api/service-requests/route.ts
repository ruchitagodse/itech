import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { validateServiceRequest } from "@/lib/service-requests/data";
import { listServiceRequests, submitServiceRequest } from "@/lib/service-requests/server";
import { serviceRequestError } from "@/lib/service-requests/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role === "technician") return NextResponse.json({ error: "Request access denied." }, { status: 403 });
  try {
    const query = new URL(request.url).searchParams;
    return NextResponse.json(await listServiceRequests(profile, query.get("status") ?? "", query.get("cursor") ?? ""), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return serviceRequestError(error); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role === "technician") return NextResponse.json({ error: "Request access denied." }, { status: 403 });
  try {
    const { data, errors } = validateServiceRequest(await customerBody(request));
    if (!data) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    return NextResponse.json({ id: await submitServiceRequest(profile, data) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return serviceRequestError(error); }
}
