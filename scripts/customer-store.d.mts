import type { Firestore } from "firebase-admin/firestore";
import type { CustomerInput } from "../src/lib/customers/data";
export class CustomerStoreError extends Error { code: string; }
export function saveCustomer(db: Firestore, input: CustomerInput, context: {
  operatorUid: string; resolvedOwnerUid?: string | null; id?: string;
}): Promise<string>;
