import type { Firestore, Transaction, DocumentReference } from "firebase-admin/firestore";
export { indiaDate, validPlanDate, planBalance } from "./service-plan-dates.mjs";
export function applianceRef(db: Firestore, customerId: string, applianceId: string): DocumentReference;
export function findIncludedPlan(tx: Transaction, db: Firestore, customerId: string, applianceId: string, serviceType: string): Promise<{ servicePlanId: string; servicePlanName: string; servicePlanOutcome: string; servicePlanCreditUsed: boolean } | null>;
export function preparePlanCompletion(tx: Transaction, db: Firestore, request: { customerId: string; applianceId: string; serviceType: string; servicePlanId?: string | null; visitId?: string | null; schemaVersion?: number; maintenanceCoverage?: string }, requestId: string, actorUid: string): Promise<() => { servicePlanOutcome?: string; servicePlanCreditUsed?: boolean }>;
