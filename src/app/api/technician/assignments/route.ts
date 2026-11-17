import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { listAssignments } from "@/lib/assignments/server";
import { serviceRequestError } from "@/lib/service-requests/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "technician") return NextResponse.json({ error: "Technician access required." }, { status: 403 });
  try {
    const query = new URL(request.url).searchParams;
    return NextResponse.json(await listAssignments(profile, query.get("status") ?? "", query.get("cursor") ?? ""), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return serviceRequestError(error); }
}
