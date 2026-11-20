import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { validateCustomer } from "@/lib/customers/data";
import { getCustomer, persistCustomer } from "@/lib/customers/server";
import { customerBody, customerError } from "@/lib/customers/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const customer = await getCustomer(profile, (await params).id);
    return customer ? NextResponse.json({ customer }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Customer not found." }, { status: 404 });
  } catch (error) { return customerError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const { data, errors } = validateCustomer(await customerBody(request));
    if (!data) return NextResponse.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    const id = (await params).id;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    return NextResponse.json({ id: await persistCustomer(profile, data, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerError(error); }
}
