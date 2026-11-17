import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { listTechnicians } from "@/lib/assignments/server";
import { serviceRequestError } from "@/lib/service-requests/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try { return NextResponse.json(await listTechnicians(profile, new URL(request.url).searchParams.get("cursor") ?? ""), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return serviceRequestError(error); }
}
