import { FieldValue } from "firebase-admin/firestore";
export class CustomerStoreError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function keys(data) {
  return ["email_" + data.email, "phone_" + data.phone, ...(data.ownerUid ? ["owner_" + data.ownerUid] : [])];
}
function searchTokens(data) {
  const tokens = new Set();
  for (const value of [data.fullName.toLowerCase(), ...data.fullName.toLowerCase().split(" "), data.email, data.phone]) {
    for (let length = 1; length <= value.length; length++) tokens.add(value.slice(0, length));
  }
  return [...tokens];
}
// No Auth users are created or changed. Uniqueness and record writes commit together.
export async function saveCustomer(db, input, { operatorUid, resolvedOwnerUid = null, id }) {
  const reference = id ? db.collection("customers").doc(id) : db.collection("customers").doc();
  await db.runTransaction(async transaction => {
    const actor = await transaction.get(db.doc("users/" + operatorUid));
    if (actor.data()?.role !== "admin" || actor.data()?.active !== true) throw new CustomerStoreError("forbidden");
    const snapshot = await transaction.get(reference);
    if (id && !snapshot.exists) throw new CustomerStoreError("not-found");
    const previous = snapshot.data();
    const ownerUid = previous?.ownerUid ?? resolvedOwnerUid;
    const next = { ...input, ownerUid };
    const nextKeys = keys(next);
    const oldKeys = previous ? keys(previous) : [];
    const allKeys = [...new Set([...nextKeys, ...oldKeys])];
    const reservations = await Promise.all(allKeys.map(key => transaction.get(db.collection("customerKeys").doc(key))));
    const byKey = new Map(allKeys.map((key, index) => [key, reservations[index]]));
    for (const key of nextKeys) {
      const reservation = byKey.get(key);
      if (reservation.exists && reservation.data().customerId !== reference.id) throw new CustomerStoreError("duplicate-" + key.split("_")[0]);
    }
    for (const key of oldKeys.filter(key => !nextKeys.includes(key))) {
      if (byKey.get(key).data()?.customerId === reference.id) transaction.delete(db.collection("customerKeys").doc(key));
    }
    for (const key of nextKeys) transaction.set(db.collection("customerKeys").doc(key), { customerId: reference.id });
    transaction.set(reference, {
      ...next, searchTokens: searchTokens(next),
      createdAt: previous?.createdAt ?? FieldValue.serverTimestamp(),
      createdBy: previous?.createdBy ?? operatorUid,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: operatorUid,
    });
  });
  return reference.id;
}
