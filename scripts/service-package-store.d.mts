import type { Firestore } from "firebase-admin/firestore";
import type { ServicePackageInput } from "../src/lib/service-packages/data";
export class PackageStoreError extends Error { code: string; }
export function saveServicePackage(db: Firestore, input: ServicePackageInput, context: { operatorUid: string; id?: string; expectedVersion?: number }): Promise<string>;
