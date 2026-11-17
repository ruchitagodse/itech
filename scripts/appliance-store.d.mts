import type { Firestore } from "firebase-admin/firestore";
import type { ApplianceInput } from "../src/lib/appliances/data";
export class ApplianceStoreError extends Error { code: string; }
export function saveAppliance(db: Firestore, customerId: string, input: ApplianceInput, context: { operatorUid: string; id?: string }): Promise<string>;
