import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { customerBody } from "@/lib/customers/http";
import { validatePackage } from "@/lib/service-packages/data";
import { listServicePackages, persistServicePackage } from "@/lib/service-packages/server";
import { packageError } from "@/lib/service-packages/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role === "technician") return NextResponse.json({ error: "Package access denied." }, { status: 403 });
  try { return NextResponse.json(await listServicePackages(profile, new URL(request.url).searchParams.get("cursor") ?? ""), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return packageError(error); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const { data, errors } = validatePackage(await customerBody(request));
    if (!data) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    return NextResponse.json({ id: await persistServicePackage(profile, data) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return packageError(error); }
}
