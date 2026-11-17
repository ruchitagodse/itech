import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { validateAssignment } from "@/lib/assignments/data";
import { persistAssignment } from "@/lib/assignments/server";
import { serviceRequestError } from "@/lib/service-requests/http";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const input = validateAssignment(await customerBody(request));
    if (!input) return NextResponse.json({ error: "Choose a technician and refresh the request if it changed." }, { status: 400 });
    await persistAssignment(profile, (await params).id, input);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return serviceRequestError(error); }
}
