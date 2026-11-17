import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { validatePackage } from "@/lib/service-packages/data";
import { getServicePackage, persistServicePackage } from "@/lib/service-packages/server";
import { packageError } from "@/lib/service-packages/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role === "technician") return NextResponse.json({ error: "Package access denied." }, { status: 403 });
  try {
    const item = await getServicePackage(profile, (await params).id);
    return item ? NextResponse.json(item, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Package not found." }, { status: 404 });
  } catch (error) { return packageError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const body = await customerBody(request);
    const { data, errors } = validatePackage(body);
    if (!data || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) return NextResponse.json({ error: "Check the highlighted fields, or refresh if this package changed.", errors }, { status: 400 });
    return NextResponse.json({ id: await persistServicePackage(profile, data, (await params).id, body.expectedVersion) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return packageError(error); }
}
