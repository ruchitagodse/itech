import type { Firestore } from "firebase-admin/firestore";
export class LifecycleError extends Error {code:string}
export function lifecycleAction(db:Firestore,uid:string,input:Record<string,unknown>):Promise<string>;
