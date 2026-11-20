import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminServices } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_SECONDS, trustedProfile } from "@/lib/auth";
import { sameOrigin } from "@/lib/request-security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("idToken" in body) || typeof body.idToken !== "string" || !body.idToken.trim() || body.idToken.length > 10000) return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });
  try {
    const idToken = body.idToken;
    const { auth } = adminServices();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (!decoded.email_verified || Date.now() / 1000 - decoded.auth_time > 300) return NextResponse.json({ error: "Verify your email and sign in again." }, { status: 401 });
    const profile = await trustedProfile(decoded.uid);
    if (!profile) return NextResponse.json({ error: "Your account does not have an active platform profile. Contact your administrator." }, { status: 403 });
    const session = await auth.createSessionCookie(idToken, { expiresIn: SESSION_SECONDS * 1000 });
    (await cookies()).set(SESSION_COOKIE, session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
    return NextResponse.json({ destination: "/" + profile.role }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not establish a session. Check your sign-in or contact your administrator." }, { status: 401 });
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin rejected." }, { status: 403 });
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (session) {
    try {
      const { auth } = adminServices();
      const decoded = await auth.verifySessionCookie(session, true);
      await auth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Always clear the browser cookie, including expired or revoked sessions.
    }
  }
  store.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
