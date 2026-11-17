import { FieldValue } from "firebase-admin/firestore";

// Firestore-only portion shared with emulator tests. Auth account creation stays in the privileged CLI or server provisioning service.
export async function createProfile(db, { uid, email, displayName, role, bootstrap, operatorUid }) {
  await db.runTransaction(async transaction => {
    if (bootstrap) {
      const lock = db.doc("system/adminBootstrap");
      const [marker, admins] = await Promise.all([
        transaction.get(lock),
        transaction.get(db.collection("users").where("role", "==", "admin").limit(1)),
      ]);
      if (marker.exists || !admins.empty) throw new Error("Bootstrap is already closed.");
      transaction.create(lock, { uid, createdAt: FieldValue.serverTimestamp() });
    } else {
      const actor = await transaction.get(db.doc("users/" + operatorUid));
      if (actor.data()?.role !== "admin" || actor.data()?.active !== true) throw new Error("Admin operator authorization changed.");
    }
    transaction.create(db.doc("users/" + uid), {
      email, displayName, role, active: true, createdAt: FieldValue.serverTimestamp(),
      createdBy: bootstrap ? "bootstrap" : operatorUid,
    });
  });
}
