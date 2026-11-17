import type { Firestore } from "firebase-admin/firestore";
export function createProfile(db: Firestore, input: {
  uid: string; email: string; displayName: string;
  role: "admin" | "technician" | "customer";
  bootstrap: boolean; operatorUid?: string;
}): Promise<void>;
