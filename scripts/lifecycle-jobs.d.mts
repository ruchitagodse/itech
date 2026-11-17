import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
export function reminderEvents(view:string,id:string,data:import("firebase-admin/firestore").DocumentData,settings:import("firebase-admin/firestore").DocumentData,today?:string):import("firebase-admin/firestore").DocumentData[];
export function runLifecycleJobs(db:Firestore,auth:Auth,config:Record<string,string|undefined>):Promise<Record<string,unknown>>;
