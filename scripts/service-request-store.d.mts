import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import type { ServiceRequestInput, RequestStatus } from "../src/lib/service-requests/data";
export class ServiceRequestError extends Error { code: string; }
export function createServiceRequest(db: Firestore, input: ServiceRequestInput, actorUid: string): Promise<string>;
export function updateServiceRequestStatus(db: Firestore, id: string, status: RequestStatus, expectedStatus: RequestStatus, actorUid: string, auth?: Pick<Auth, "getUser">, completionNotes?: string): Promise<void>;

export function keyFor(data: { customerId: string; applianceId: string; serviceType: string }): string;
