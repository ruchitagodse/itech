import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { isStatus } from "@/lib/service-requests/data";
import { getServiceRequest, changeRequestStatus } from "@/lib/service-requests/server";
import { serviceRequestError } from "@/lib/service-requests/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role === "technician") return NextResponse.json({ error: "Request access denied." }, { status: 403 });
  try {
    const item = await getServiceRequest(profile, (await params).id);
    return item ? NextResponse.json(item, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Request not found." }, { status: 404 });
  } catch (error) { return serviceRequestError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const body = await customerBody(request);
    if (!body || !isStatus(body.status) || !isStatus(body.expectedStatus)) return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
    if (body.status === "completed" && (typeof body.notes !== "string" || !body.notes.trim() || body.notes.trim().length > 2000))
      return NextResponse.json({ error: "Add service notes of up to 2,000 characters before completing work." }, { status: 400 });
    await changeRequestStatus(profile, (await params).id, body.status, body.expectedStatus, body.status === "completed" ? body.notes : undefined);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return serviceRequestError(error); }
}
