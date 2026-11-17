import { FieldValue } from "firebase-admin/firestore";
export class ApplianceStoreError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function serialKey(data) { return data.serialNumber ? "serial_" + data.brand.toLowerCase() + "|" + data.serialNumber : ""; }
export async function saveAppliance(db, customerId, input, { operatorUid, id }) {
  const parent = db.collection("customers").doc(customerId);
  const reference = id ? parent.collection("appliances").doc(id) : parent.collection("appliances").doc();
  await db.runTransaction(async transaction => {
    const [actor, customer, snapshot] = await Promise.all([
      transaction.get(db.doc("users/" + operatorUid)), transaction.get(parent), transaction.get(reference),
    ]);
    if (actor.data()?.role !== "admin" || actor.data()?.active !== true) throw new ApplianceStoreError("forbidden");
    if (!customer.exists || id && !snapshot.exists) throw new ApplianceStoreError("not-found");
    const previous = snapshot.data();
    const nextKey = serialKey(input);
    const oldKey = previous ? serialKey(previous) : "";
    const keys = [...new Set([nextKey, oldKey].filter(Boolean))];
    const reservations = await Promise.all(keys.map(key => transaction.get(db.collection("applianceKeys").doc(key))));
    const byKey = new Map(keys.map((key, index) => [key, reservations[index]]));
    const matches = reservation => reservation?.data()?.customerId === customerId && reservation?.data()?.applianceId === reference.id;
    if (nextKey && byKey.get(nextKey).exists && !matches(byKey.get(nextKey))) throw new ApplianceStoreError("duplicate-serial");
    if (oldKey && oldKey !== nextKey && matches(byKey.get(oldKey))) transaction.delete(db.collection("applianceKeys").doc(oldKey));
    if (nextKey) transaction.set(db.collection("applianceKeys").doc(nextKey), { customerId, applianceId: reference.id });
    transaction.set(reference, {
      ...input, createdAt: previous?.createdAt ?? FieldValue.serverTimestamp(), createdBy: previous?.createdBy ?? operatorUid,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: operatorUid,
    });
  });
  return reference.id;
}
