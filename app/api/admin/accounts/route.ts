import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
import { parseAccountInput, provisionAccount, ProvisionError } from "@/lib/provision-account";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const operator = await currentProfile();
  if (!operator) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (operator.role !== "admin") return NextResponse.json({ error: "Only an Admin can create accounts." }, { status: 403 });
  let input;
  try {
    const body = await request.text();
    if (body.length > 4096) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    input = parseAccountInput(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "Invalid account details." }, { status: 400 });
  }
  if (!input) return NextResponse.json({ error: "Enter a valid name, email, and Technician or Customer role." }, { status: 400 });
  try {
    const account = await provisionAccount(input, operator.uid);
    return NextResponse.json({ account }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ProvisionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Account creation is unavailable. Please try again later." }, { status: 503 });
  }
}
