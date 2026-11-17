import { validPolicy } from "./lifecycle-policy.mjs";
import { FieldValue } from "firebase-admin/firestore";
export class PackageStoreError extends Error { constructor(code) { super(code); this.code = code; } }
const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export async function saveServicePackage(db, input, { operatorUid, id, expectedVersion }) {
  if (!validId(operatorUid) || id && !validId(id) || typeof input?.name !== "string" || !input.name.trim() || input.name.length > 100
    || !["water_purifier","ac"].includes(input.applianceType) || !["installation","maintenance","repair"].includes(input.serviceType)
    || !Number.isSafeInteger(input.pricePaise) || input.pricePaise <= 0 || input.pricePaise > 100000000
    || typeof input.description !== "string" || !input.description.trim() || input.description.length > 1000 || typeof input.active !== "boolean"
    || id && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) throw new PackageStoreError("invalid");
  if (input.policy !== undefined && input.policy !== null && !validPolicy(input.policy)) throw new PackageStoreError("invalid");
  const reference = id ? db.collection("servicePackages").doc(id) : db.collection("servicePackages").doc();
  await db.runTransaction(async tx => {
    const [actor, snapshot] = await Promise.all([tx.get(db.doc("users/" + operatorUid)), tx.get(reference)]);
    if (actor.data()?.role !== "admin" || actor.data()?.active !== true) throw new PackageStoreError("forbidden");
    if (id && !snapshot.exists) throw new PackageStoreError("not-found");
    const previous = snapshot.data();
    if (id && previous.version !== expectedVersion) throw new PackageStoreError("conflict");
    const policy = input.policy ?? previous?.policy;
    if (input.active && input.serviceType === "maintenance" && policy && policy.validityMonths < policy.maintenanceIntervalMonths * 2)
      throw new PackageStoreError("schedule-conflict");
    tx.set(reference, {
      name: input.name.trim().replace(/\s+/g, " "), applianceType: input.applianceType, serviceType: input.serviceType,
      pricePaise: input.pricePaise, description: input.description.trim(), active: input.active,
      ...((input.policy ?? previous?.policy) ? { policy: { validityMonths: (input.policy ?? previous.policy).validityMonths, maintenanceIntervalMonths: (input.policy ?? previous.policy).maintenanceIntervalMonths } } : {}),
      version: (previous?.version ?? 0) + 1,
      createdAt: previous?.createdAt ?? FieldValue.serverTimestamp(), createdBy: previous?.createdBy ?? operatorUid,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: operatorUid,
    });
  });
  return reference.id;
}
