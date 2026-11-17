import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createProfile } from "./provisioning-store.mjs";

const { values } = parseArgs({ options: { bootstrap: { type: "boolean", default: false }, email: { type: "string" }, name: { type: "string" }, role: { type: "string" }, project: { type: "string" } }, strict: true });
const projectId = process.env.FIREBASE_PROJECT_ID;
const role = values.bootstrap ? "admin" : values.role;
if (!projectId || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) throw new Error("Configure the server fields in .env.local first.");
if (values.project !== projectId || projectId !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw new Error("Pass --project with the exact development Firebase project ID matching both environment fields.");
if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || !values.name?.trim() || values.name.length > 100 || !["admin", "technician", "customer"].includes(role)) throw new Error("Required: --project ID --email EMAIL --name NAME --role admin|technician|customer (role omitted for bootstrap).");
if (values.bootstrap && values.role) throw new Error("Bootstrap fixes the role to admin; omit --role.");

const app = initializeApp({ credential: cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }), projectId });
const auth = getAuth(app);
const db = getFirestore(app);
let createdUid;
let committed = false;
try {
  // Require public signup to be disabled before creating any account.
  const token = await app.options.credential.getAccessToken();
  const configResponse = await fetch("https://identitytoolkit.googleapis.com/admin/v2/projects/" + encodeURIComponent(projectId) + "/config", { headers: { Authorization: "Bearer " + token.access_token } });
  if (!configResponse.ok) throw new Error("Cannot verify the Identity Platform signup policy. Enable Identity Platform and grant firebaseauth.configs.get to this operator.");
  const config = await configResponse.json();
  if (config.client?.permissions?.disabledUserSignup !== true) throw new Error("Disable end-user signup in Identity Platform before provisioning. See README.md.");

  const lock = db.doc("system/adminBootstrap");
  if (values.bootstrap) {
    if ((await lock.get()).exists || !(await db.collection("users").where("role", "==", "admin").limit(1).get()).empty) throw new Error("Bootstrap is already closed or an Admin exists.");
  } else {
    const uid = process.env.ADMIN_OPERATOR_UID;
    if (!uid) throw new Error("Set ADMIN_OPERATOR_UID to your active Admin UID.");
    const [actor, actorProfile] = await Promise.all([auth.getUser(uid), db.doc("users/" + uid).get()]);
    if (actor.disabled || !actor.emailVerified || actorProfile.data()?.role !== "admin" || actorProfile.data()?.active !== true) throw new Error("Provisioning requires an active, verified Admin operator.");
  }
  // No password is accepted or printed. The account holder sets one by email.
  const user = await auth.createUser({ email: values.email.trim(), displayName: values.name.trim(), password: "Aa1!" + randomBytes(48).toString("base64url"), emailVerified: false });
  createdUid = user.uid;
  await createProfile(db, {
    uid: user.uid, email: user.email, displayName: values.name.trim(), role,
    bootstrap: values.bootstrap, operatorUid: process.env.ADMIN_OPERATOR_UID,
  });
  committed = true;
  console.log("Created " + role + " profile. UID: " + user.uid);
  console.log("Use Forgot password on the local login page to set your password. Then sign in, request email verification if needed, and verify your email.");
} catch (error) {
  if (createdUid && !committed) {
    try { await auth.deleteUser(createdUid); }
    catch { console.error("Rollback failed. Remove orphan Auth user with UID " + createdUid + " using Firebase Console before retrying."); }
  }
  console.error(error instanceof Error ? error.message : "Provisioning failed.");
  process.exitCode = 1;
} finally { await deleteApp(app); }
