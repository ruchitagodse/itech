import type { Firestore } from "firebase-admin/firestore";
export function notificationId(...parts:unknown[]):string;
export function equalSecret(a:unknown,b:unknown):boolean;
export function validSignature(raw:string,signature:string|null,secret:string|undefined):boolean;
export function nextDelivery(current:string,incoming:string):string;
export function enqueue(db:Firestore,event:import("firebase-admin/firestore").DocumentData,recipientUid:string):Promise<boolean>;
export function dispatchNotification(db:Firestore,auth:import("firebase-admin/auth").Auth,id:string,settings:import("firebase-admin/firestore").DocumentData,config:Record<string,string|undefined>,send?:typeof fetch,now?:number):Promise<string>;
export function applyDelivery(db:Firestore,status:import("firebase-admin/firestore").DocumentData):Promise<boolean>;

export function noticeDatesCurrent(data:import("firebase-admin/firestore").DocumentData,today?:string):boolean;
