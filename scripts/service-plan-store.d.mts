import type { Firestore } from "firebase-admin/firestore";
import type { PlanInput } from "../src/lib/service-plans/data";
export class PlanStoreError extends Error { code: string; }
export function createAppliancePlan(db: Firestore, customerId: string, applianceId: string, input: PlanInput, operatorUid: string, options?: { managed: boolean }): Promise<string>;
