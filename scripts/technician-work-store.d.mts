import type { Firestore } from "firebase-admin/firestore";
import type { WorkInput } from "../src/lib/technician-work/data";
export function updateTechnicianWork(db: Firestore, id: string, input: WorkInput, actorUid: string): Promise<void>;
