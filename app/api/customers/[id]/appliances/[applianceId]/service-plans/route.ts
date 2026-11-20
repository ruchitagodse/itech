import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { validatePlan } from "@/lib/service-plans/data";
import { listAppliancePlans, persistPlan } from "@/lib/service-plans/server";
import { planError } from "@/lib/service-plans/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; applianceId: string }> };
export async function GET(request: Request, { params }: Context) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role === "technician") return NextResponse.json({ error: "Plan access denied." }, { status: 403 });
  try { const { id,applianceId } = await params; return NextResponse.json(await listAppliancePlans(profile,id,applianceId,new URL(request.url).searchParams.get("cursor") ?? ""), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return planError(error); }
}
export async function POST(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const input = validatePlan(await customerBody(request));
    if (!input) return NextResponse.json({ error: "Enter a plan name and valid dates. Expiry cannot be before the start date." }, { status: 400 });
    const { id,applianceId } = await params;
    return NextResponse.json({ id: await persistPlan(profile,id,applianceId,input) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return planError(error); }
}
