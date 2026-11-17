import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
export function assignTechnician(db: Firestore, auth: Pick<Auth, "getUser">, id: string, technicianUid: string | null, expectedVersion: number, operatorUid: string): Promise<void>;
