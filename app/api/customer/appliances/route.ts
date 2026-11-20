import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { customerAppliances } from "@/lib/appliances/server";
import { applianceError } from "@/lib/appliances/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "customer") return NextResponse.json({ error: "Customer access required." }, { status: 403 });
  try {
    return NextResponse.json(await customerAppliances(profile, new URL(request.url).searchParams.get("cursor") ?? ""), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return applianceError(error); }
}
