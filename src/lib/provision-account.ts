import "server-only";
import { randomBytes } from "node:crypto";
import { adminServices } from "@/lib/firebase/admin";
import { createProfile } from "../../scripts/provisioning-store.mjs";

export type AccountInput = { email: string; displayName: string; role: "technician" | "customer" };
export class ProvisionError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export function parseAccountInput(value: unknown): AccountInput | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.email !== "string" || typeof data.displayName !== "string") return null;
  const email = data.email.trim();
  const displayName = data.displayName.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || displayName.length > 100) return null;
  if (data.role !== "technician" && data.role !== "customer") return null;
  return { email, displayName, role: data.role };
}
export async function provisionAccount(input: AccountInput, operatorUid: string) {
  const { auth, db } = adminServices();
  const credential = auth.app.options.credential;
  if (!credential) throw new ProvisionError("Account creation is not configured. Contact your administrator.", 503);
  let config: { client?: { permissions?: { disabledUserSignup?: boolean } } };
  try {
    const token = await credential.getAccessToken();
    const response = await fetch("https://identitytoolkit.googleapis.com/admin/v2/projects/" +
      encodeURIComponent(process.env.FIREBASE_PROJECT_ID!) + "/config", {
      headers: { Authorization: "Bearer " + token.access_token }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Configuration unavailable");
    config = await response.json();
  } catch {
    throw new ProvisionError("Could not check Firebase signup settings. Check service-account configuration and try again.", 503);
  }
  if (config.client?.permissions?.disabledUserSignup !== true) {
    throw new ProvisionError("Account creation is paused. Disable public signup in Firebase before provisioning accounts.", 503);
  }
  let uid: string | undefined;
  try {
    const user = await auth.createUser({
      email: input.email, displayName: input.displayName,
      password: "Aa1!" + randomBytes(48).toString("base64url"), emailVerified: false,
    });
    uid = user.uid;
    await createProfile(db, { ...input, uid, bootstrap: false, operatorUid });
    return { uid, email: input.email, role: input.role };
  } catch (error) {
    if (uid) {
      try { await auth.deleteUser(uid); }
      catch { console.error("Account provisioning rollback failed for new UID:", uid); }
    }
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "auth/email-already-exists") throw new ProvisionError("An account already exists for this email address.", 409);
    if (code === "auth/invalid-email") throw new ProvisionError("Enter a valid email address.", 400);
    throw new ProvisionError("Could not create the account. Contact your administrator before retrying.", 503);
  }
}
