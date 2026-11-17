import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminServices } from "@/lib/firebase/admin";
import { isRole, type Profile, type Role } from "@/lib/roles";
export const SESSION_COOKIE = "itech_session";
export const SESSION_SECONDS = 60 * 60 * 8;
export async function trustedProfile(uid: string): Promise<Profile | null> {
  const { auth, db } = adminServices();
  const [record, snapshot] = await Promise.all([auth.getUser(uid), db.collection("users").doc(uid).get()]);
  const data = snapshot.data();
  if (record.disabled || !record.emailVerified || !data || data.active !== true || !isRole(data.role)) return null;
  return { uid, email: record.email ?? "", displayName: typeof data.displayName === "string" ? data.displayName : "there", role: data.role };
}
export async function currentProfile(): Promise<Profile | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  try {
    const decoded = await adminServices().auth.verifySessionCookie(session, true);
    if (!decoded.email_verified) return null;
    return await trustedProfile(decoded.uid);
  } catch { return null; }
}
export async function requireRole(role: Role) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== role) redirect("/" + profile.role);
  return profile;
}
