import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { validateWork } from "@/lib/technician-work/data";
import { persistWork } from "@/lib/technician-work/server";
import { serviceRequestError } from "@/lib/service-requests/http";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "technician") return NextResponse.json({ error: "Technician access required." }, { status: 403 });
  try {
    const input = validateWork(await customerBody(request));
    if (!input) return NextResponse.json({ error: "Check the notes (maximum 2,000 characters). Notes are required to complete work." }, { status: 400 });
    await persistWork(profile, (await params).id, input);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return serviceRequestError(error); }
}
