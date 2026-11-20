import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { getAssignment } from "@/lib/assignments/server";
import { serviceRequestError } from "@/lib/service-requests/http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "technician") return NextResponse.json({ error: "Technician access required." }, { status: 403 });
  try {
    const item = await getAssignment(profile, (await params).id);
    return item ? NextResponse.json(item, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  } catch (error) { return serviceRequestError(error); }
}
