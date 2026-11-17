import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
export function adminServices() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10));
  if (!projectId || !clientEmail || !privateKey) throw new Error("Server Firebase configuration is missing.");
  if (projectId !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw new Error("Firebase project configuration mismatch.");
  const app = getApps().find(app => app.name === "itech-v2") ??
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, "itech-v2");
  return { auth: getAuth(app), db: getFirestore(app) };
}
