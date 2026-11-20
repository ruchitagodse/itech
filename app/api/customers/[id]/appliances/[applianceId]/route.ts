import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { validateAppliance } from "@/lib/appliances/data";
import { getAppliance, persistAppliance } from "@/lib/appliances/server";
import { applianceError } from "@/lib/appliances/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; applianceId: string }> };
export async function GET(_request: Request, { params }: Context) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role === "technician") return NextResponse.json({ error: "Appliance access denied." }, { status: 403 });
  try {
    const { id, applianceId } = await params;
    const appliance = await getAppliance(profile, id, applianceId);
    return appliance ? NextResponse.json({ appliance }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Appliance not found." }, { status: 404 });
  } catch (error) { return applianceError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const { data, errors } = validateAppliance(await customerBody(request));
    if (!data) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    const { id, applianceId } = await params;
    return NextResponse.json({ id: await persistAppliance(profile, id, data, applianceId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return applianceError(error); }
}
