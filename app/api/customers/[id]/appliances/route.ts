import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { validateAppliance } from "@/lib/appliances/data";
import { listAppliances, persistAppliance } from "@/lib/appliances/server";
import { applianceError } from "@/lib/appliances/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role === "technician") return NextResponse.json({ error: "Appliance access denied." }, { status: 403 });
  try {
    return NextResponse.json(await listAppliances(profile, (await params).id, new URL(request.url).searchParams.get("cursor") ?? ""), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return applianceError(error); }
}
export async function POST(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const { data, errors } = validateAppliance(await customerBody(request));
    if (!data) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    return NextResponse.json({ id: await persistAppliance(profile, (await params).id, data) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return applianceError(error); }
}
