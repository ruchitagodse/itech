import { createAppliancePlan as createPlanPeriod } from "../scripts/service-plan-store.mjs";
import { planBalance, preparePlanCompletion } from "../scripts/service-plan-core.mjs";
import { saveServicePackage } from "../scripts/service-package-store.mjs";
import { updateTechnicianWork } from "../scripts/technician-work-store.mjs";
import { assignTechnician } from "../scripts/assignment-store.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { createServiceRequest, updateServiceRequestStatus } from "../scripts/service-request-store.mjs";
import { saveAppliance } from "../scripts/appliance-store.mjs";
import { saveCustomer } from "../scripts/customer-store.mjs";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createProfile } from "../scripts/provisioning-store.mjs";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, setLogLevel, query, where, writeBatch, serverTimestamp } from "firebase/firestore";

setLogLevel("silent");
// Historical fixture periods deliberately use the legacy schema; app operations default to managed mode.
const createAppliancePlan = (db,c,a,input,uid,options={managed:false}) => createPlanPeriod(db,c,a,input,uid,options);
const projectId = "demo-itech-v2";
const expectedHost = "127.0.0.1:8187";
let environment;
let adminApp;
let adminDb;
before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== expectedHost) {
    throw new Error("Rules tests require the isolated loopback Firestore emulator. No cloud fallback is allowed.");
  }
  adminApp = initializeApp({ projectId }, "bootstrap-emulator-tests");
  adminDb = getFirestore(adminApp);
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { host: "127.0.0.1", port: 8187, rules: await readFile("firestore.rules", "utf8") },
  });
});
after(async () => { await environment?.cleanup(); if (adminApp) await deleteApp(adminApp); });

for (const identity of ["unauthenticated", "admin", "technician", "customer"]) {
  for (const target of ["users/rules-test-user", "system/adminBootstrap", "unknown/rules-test-document"]) {
    test(identity + " is denied all client access to " + target, async () => {
      // Claims are synthetic emulator identities, not Firebase Auth accounts.
      // Even an admin role claim must not bypass default-deny client rules.
      const context = identity === "unauthenticated"
        ? environment.unauthenticatedContext()
        : environment.authenticatedContext("rules-test-" + identity, { role: identity, email_verified: true });
      const db = context.firestore();
      const reference = doc(db, target);
      await assertFails(getDoc(reference));
      await assertFails(getDocs(collection(db, target.split("/")[0])));
      await assertFails(setDoc(reference, { synthetic: true }));
      await assertFails(updateDoc(reference, { synthetic: true }));
      await assertFails(deleteDoc(reference));
    });
  }
}

function syntheticProfile(uid) {
  return { uid, email: uid + "@example.invalid", displayName: "Synthetic emulator profile", role: "admin", bootstrap: true };
}
test("bootstrap transaction commits marker and first profile atomically", async () => {
  await environment.clearFirestore();
  await createProfile(adminDb, syntheticProfile("bootstrap-first"));
  const [marker, profile] = await Promise.all([
    adminDb.doc("system/adminBootstrap").get(), adminDb.doc("users/bootstrap-first").get(),
  ]);
  assert.equal(marker.data().uid, "bootstrap-first");
  assert.equal(profile.data().role, "admin");
});
test("bootstrap transaction rejects repeat attempt after first profile is removed", async () => {
  await environment.clearFirestore();
  await createProfile(adminDb, syntheticProfile("bootstrap-first"));
  await adminDb.doc("users/bootstrap-first").delete();
  await assert.rejects(createProfile(adminDb, syntheticProfile("bootstrap-second")), /Bootstrap is already closed/);
  assert.equal((await adminDb.doc("users/bootstrap-second").get()).exists, false);
});
test("bootstrap transaction rejects existing Admin even without a marker", async () => {
  await environment.clearFirestore();
  await adminDb.doc("users/existing-emulator-admin").set({ role: "admin", active: true });
  await assert.rejects(createProfile(adminDb, syntheticProfile("bootstrap-second")), /Bootstrap is already closed/);
  assert.equal((await adminDb.doc("system/adminBootstrap").get()).exists, false);
});
test("concurrent bootstrap transactions produce exactly one profile", async () => {
  await environment.clearFirestore();
  const results = await Promise.allSettled([
    createProfile(adminDb, syntheticProfile("bootstrap-race-a")),
    createProfile(adminDb, syntheticProfile("bootstrap-race-b")),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await adminDb.collection("users").get()).size, 1);
  assert.equal((await adminDb.doc("system/adminBootstrap").get()).exists, true);
});

async function seedCustomerFixtures() {
  await environment.clearFirestore();
  const batch = adminDb.batch();
  for (const [uid, role, active] of [["cm-admin", "admin", true], ["cm-a", "customer", true], ["cm-b", "customer", true], ["cm-tech", "technician", true], ["cm-inactive", "admin", false]]) {
    batch.set(adminDb.doc("users/" + uid), { role, active });
  }
  await batch.commit();
  const first = await saveCustomer(adminDb, sampleCustomer("alpha@example.invalid", "9876543210"), { operatorUid: "cm-admin", resolvedOwnerUid: "cm-a" });
  const second = await saveCustomer(adminDb, sampleCustomer("beta@example.invalid", "9876543211"), { operatorUid: "cm-admin", resolvedOwnerUid: "cm-b" });
  return { first, second };
}
function sampleCustomer(email, phone) {
  return { fullName: "Synthetic Customer", email, phone, alternatePhone: "", address: "Synthetic address", city: "Pune", state: "Maharashtra", pincode: "411001", active: true };
}
function customerClient(uid, verified = true, claims = {}) {
  return environment.authenticatedContext(uid, { email_verified: verified, ...claims }).firestore();
}
function clientCreate(db, id, input, uid = "cm-admin") {
  const batch = writeBatch(db);
  batch.set(doc(db, "customers/" + id), { ...input, ownerUid: null, searchTokens: [], createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), updatedBy: uid });
  batch.set(doc(db, "customerKeys/email_" + input.email), { customerId: id });
  batch.set(doc(db, "customerKeys/phone_" + input.phone), { customerId: id });
  return batch.commit();
}
test("Customer rules: Admin reads and lists all records", async () => {
  const { first, second } = await seedCustomerFixtures();
  const db = customerClient("cm-admin");
  await assertSucceeds(getDoc(doc(db, "customers/" + first)));
  await assertSucceeds(getDoc(doc(db, "customers/" + second)));
  await assertSucceeds(getDocs(collection(db, "customers")));
});
test("Customer rules: Admin creates and edits a valid record atomically", async () => {
  await seedCustomerFixtures();
  const db = customerClient("cm-admin");
  await assertSucceeds(clientCreate(db, "client-created", sampleCustomer("client@example.invalid", "9876543212")));
  await assertSucceeds(updateDoc(doc(db, "customers/client-created"), { address: "Updated address", active: false, updatedAt: serverTimestamp(), updatedBy: "cm-admin" }));
});
test("Customer rules: owner reads own document and a scoped query only", async () => {
  const { first, second } = await seedCustomerFixtures();
  const db = customerClient("cm-a");
  await assertSucceeds(getDoc(doc(db, "customers/" + first)));
  await assertSucceeds(getDocs(query(collection(db, "customers"), where("ownerUid", "==", "cm-a"))));
  await assertFails(getDoc(doc(db, "customers/" + second)));
  await assertFails(getDocs(collection(db, "customers")));
});
test("Customer rules: owner cannot edit, delete, claim another record or read duplicate keys", async () => {
  const { first, second } = await seedCustomerFixtures();
  const db = customerClient("cm-a");
  await assertFails(updateDoc(doc(db, "customers/" + first), { fullName: "Changed" }));
  await assertFails(deleteDoc(doc(db, "customers/" + first)));
  await assertFails(updateDoc(doc(db, "customers/" + second), { ownerUid: "cm-a" }));
  await assertFails(getDoc(doc(db, "customerKeys/email_alpha@example.invalid")));
  await assertFails(clientCreate(db, "customer-created", sampleCustomer("owner@example.invalid", "9876543212"), "cm-a"));
});
test("Customer rules: Technician cannot get, list or write customers", async () => {
  const { first } = await seedCustomerFixtures();
  const db = customerClient("cm-tech");
  await assertFails(getDoc(doc(db, "customers/" + first)));
  await assertFails(getDocs(collection(db, "customers")));
  await assertFails(updateDoc(doc(db, "customers/" + first), { address: "Changed" }));
  await assertFails(clientCreate(db, "tech-created", sampleCustomer("tech@example.invalid", "9876543212"), "cm-tech"));
});
test("Customer rules: unauthenticated reads and writes are denied", async () => {
  const { first } = await seedCustomerFixtures();
  const db = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "customers/" + first)));
  await assertFails(getDocs(collection(db, "customers")));
  await assertFails(setDoc(doc(db, "customers/new"), sampleCustomer("new@example.invalid", "9876543212")));
});
test("Customer rules: unverified, inactive and forged-role identities are denied", async () => {
  const { second } = await seedCustomerFixtures();
  await assertFails(getDoc(doc(customerClient("cm-admin", false), "customers/" + second)));
  await assertFails(getDoc(doc(customerClient("cm-inactive"), "customers/" + second)));
  await assertFails(getDoc(doc(customerClient("cm-a", true, { role: "admin" }), "customers/" + second)));
});
test("Customer rules: duplicate email and phone cannot steal reserved keys", async () => {
  await seedCustomerFixtures();
  const db = customerClient("cm-admin");
  await assertFails(clientCreate(db, "duplicate-email", sampleCustomer("alpha@example.invalid", "9876543212")));
  await assertFails(clientCreate(db, "duplicate-phone", sampleCustomer("unique@example.invalid", "9876543210")));
});
test("Customer rules: direct record creation without uniqueness keys is denied", async () => {
  await seedCustomerFixtures();
  const db = customerClient("cm-admin");
  await assertFails(setDoc(doc(db, "customers/no-keys"), { ...sampleCustomer("no-keys@example.invalid", "9876543212"), ownerUid: null, searchTokens: [], createdAt: serverTimestamp(), createdBy: "cm-admin", updatedAt: serverTimestamp(), updatedBy: "cm-admin" }));
});
test("Customer rules: invalid phone and pincode records are rejected", async () => {
  await seedCustomerFixtures();
  const db = customerClient("cm-admin");
  await assertFails(clientCreate(db, "bad-phone", sampleCustomer("bad-phone@example.invalid", "123")));
  await assertFails(clientCreate(db, "bad-pin", { ...sampleCustomer("bad-pin@example.invalid", "9876543212"), pincode: "000000" }));
});
test("Customer rules: ownership, creation audit fields and user roles are protected", async () => {
  const { first } = await seedCustomerFixtures();
  const db = customerClient("cm-admin");
  await assertFails(updateDoc(doc(db, "customers/" + first), { ownerUid: "cm-b", updatedAt: serverTimestamp(), updatedBy: "cm-admin" }));
  await assertFails(updateDoc(doc(db, "customers/" + first), { createdBy: "someone-else", updatedAt: serverTimestamp(), updatedBy: "cm-admin" }));
  await assertFails(updateDoc(doc(db, "users/cm-a"), { role: "admin" }));
  await assertFails(deleteDoc(doc(db, "customers/" + first)));
});
test("Customer store: concurrent duplicate email creates exactly one record", async () => {
  await seedCustomerFixtures();
  const results = await Promise.allSettled([
    saveCustomer(adminDb, sampleCustomer("race@example.invalid", "9876543212"), { operatorUid: "cm-admin" }),
    saveCustomer(adminDb, sampleCustomer("race@example.invalid", "9876543213"), { operatorUid: "cm-admin" }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await adminDb.collection("customers").where("email", "==", "race@example.invalid").get()).size, 1);
});
test("Customer store: duplicate phone and inactive duplicate email are rejected", async () => {
  const { first } = await seedCustomerFixtures();
  await assert.rejects(saveCustomer(adminDb, sampleCustomer("unique@example.invalid", "9876543210"), { operatorUid: "cm-admin" }), error => error.code === "duplicate-phone");
  await saveCustomer(adminDb, { ...sampleCustomer("alpha@example.invalid", "9876543210"), active: false }, { operatorUid: "cm-admin", id: first });
  await assert.rejects(saveCustomer(adminDb, sampleCustomer("alpha@example.invalid", "9876543212"), { operatorUid: "cm-admin" }), error => error.code === "duplicate-email");
});
test("Customer store: edits release old keys and preserve UID and creation date", async () => {
  const { first } = await seedCustomerFixtures();
  const previous = (await adminDb.doc("customers/" + first).get()).data();
  await saveCustomer(adminDb, sampleCustomer("updated@example.invalid", "9876543212"), { operatorUid: "cm-admin", id: first, resolvedOwnerUid: "cm-b" });
  const changed = (await adminDb.doc("customers/" + first).get()).data();
  assert.equal(changed.ownerUid, "cm-a");
  assert.equal(changed.createdBy, previous.createdBy);
  assert.equal(changed.createdAt.toMillis(), previous.createdAt.toMillis());
  assert.equal((await adminDb.doc("customerKeys/email_alpha@example.invalid").get()).exists, false);
  await saveCustomer(adminDb, sampleCustomer("alpha@example.invalid", "9876543210"), { operatorUid: "cm-admin" });
});
test("Customer store: duplicate owner is rejected and edits to own keys are allowed", async () => {
  const { first } = await seedCustomerFixtures();
  await assert.rejects(saveCustomer(adminDb, sampleCustomer("other@example.invalid", "9876543212"), { operatorUid: "cm-admin", resolvedOwnerUid: "cm-a" }), error => error.code === "duplicate-owner");
  await saveCustomer(adminDb, { ...sampleCustomer("alpha@example.invalid", "9876543210"), address: "Updated" }, { operatorUid: "cm-admin", id: first });
});
test("Customer store: Customer operator and missing edit target are rejected", async () => {
  await seedCustomerFixtures();
  await assert.rejects(saveCustomer(adminDb, sampleCustomer("other@example.invalid", "9876543212"), { operatorUid: "cm-a" }), error => error.code === "forbidden");
  await assert.rejects(saveCustomer(adminDb, sampleCustomer("other@example.invalid", "9876543212"), { operatorUid: "cm-admin", id: "does-not-exist" }), error => error.code === "not-found");
});

test("Customer rules reject whitespace-only required fields", async () => {
  await seedCustomerFixtures();
  await assertFails(clientCreate(customerClient("cm-admin"), "blank-name", { ...sampleCustomer("blank@example.invalid", "9876543212"), fullName: "   " }));
});
test("Customer store indexes name words, email prefixes and phone prefixes for search", async () => {
  await seedCustomerFixtures();
  assert.equal((await adminDb.collection("customers").where("searchTokens", "array-contains", "alpha@").get()).size, 1);
  assert.equal((await adminDb.collection("customers").where("searchTokens", "array-contains", "customer").get()).size, 2);
  assert.equal((await adminDb.collection("customers").where("searchTokens", "array-contains", "9876543210").get()).size, 1);
});

function sampleAppliance(serialNumber = "SERIAL-1", brand = "Test Brand") {
  return { type: "water_purifier", brand, model: "Test Model", serialNumber, purchaseDate: "2026-01-01", installationDate: "2026-01-02", notes: "", active: true };
}
async function seedAppliances() {
  const parents = await seedCustomerFixtures();
  const firstAppliance = await saveAppliance(adminDb, parents.first, sampleAppliance("SERIAL-1"), { operatorUid: "cm-admin" });
  const secondAppliance = await saveAppliance(adminDb, parents.second, { ...sampleAppliance("SERIAL-2"), type: "ac" }, { operatorUid: "cm-admin" });
  return { ...parents, firstAppliance, secondAppliance };
}
function appliancePath(customerId, id) { return "customers/" + customerId + "/appliances/" + id; }
function createClientAppliance(db, customerId, id, input, operatorUid = "cm-admin") {
  const batch = writeBatch(db);
  batch.set(doc(db, appliancePath(customerId, id)), {
    ...input, createdAt: serverTimestamp(), createdBy: operatorUid, updatedAt: serverTimestamp(), updatedBy: operatorUid,
  });
  if (input.serialNumber) batch.set(doc(db, "applianceKeys/serial_" + input.brand.toLowerCase() + "|" + input.serialNumber), { customerId, applianceId: id });
  return batch.commit();
}
test("Appliance rules: Admin reads, creates and edits appliances under a customer", async () => {
  const { first, firstAppliance, second, secondAppliance } = await seedAppliances();
  const db = customerClient("cm-admin");
  await assertSucceeds(getDoc(doc(db, appliancePath(first, firstAppliance))));
  await assertSucceeds(getDoc(doc(db, appliancePath(second, secondAppliance))));
  await assertSucceeds(getDocs(collection(db, "customers/" + first + "/appliances")));
  await assertSucceeds(createClientAppliance(db, first, "admin-created", sampleAppliance("SERIAL-3")));
  await assertSucceeds(updateDoc(doc(db, appliancePath(first, firstAppliance)), { notes: "Updated", active: false, updatedAt: serverTimestamp(), updatedBy: "cm-admin" }));
});
test("Appliance rules: Customer reads own appliances and cannot read another customer's", async () => {
  const { first, firstAppliance, second, secondAppliance } = await seedAppliances();
  const db = customerClient("cm-a");
  await assertSucceeds(getDoc(doc(db, appliancePath(first, firstAppliance))));
  await assertSucceeds(getDocs(collection(db, "customers/" + first + "/appliances")));
  await assertFails(getDoc(doc(db, appliancePath(second, secondAppliance))));
  await assertFails(getDocs(collection(db, "customers/" + second + "/appliances")));
});
test("Appliance rules: Customer cannot create, edit, delete or inspect serial reservations", async () => {
  const { first, firstAppliance } = await seedAppliances();
  const db = customerClient("cm-a");
  await assertFails(createClientAppliance(db, first, "customer-created", sampleAppliance("SERIAL-3"), "cm-a"));
  await assertFails(updateDoc(doc(db, appliancePath(first, firstAppliance)), { notes: "Changed" }));
  await assertFails(deleteDoc(doc(db, appliancePath(first, firstAppliance))));
  await assertFails(getDoc(doc(db, "applianceKeys/serial_test brand|SERIAL-1")));
});
test("Appliance rules: Technician and unauthenticated reads and writes are denied", async () => {
  const { first, firstAppliance } = await seedAppliances();
  for (const db of [customerClient("cm-tech"), environment.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(doc(db, appliancePath(first, firstAppliance))));
    await assertFails(getDocs(collection(db, "customers/" + first + "/appliances")));
    await assertFails(setDoc(doc(db, appliancePath(first, "forbidden")), sampleAppliance("SERIAL-3")));
  }
});
test("Appliance rules: forged role claims, unverified and inactive profiles are denied", async () => {
  const { second, secondAppliance } = await seedAppliances();
  for (const db of [customerClient("cm-a", true, { role: "admin" }), customerClient("cm-admin", false), customerClient("cm-inactive")]) {
    await assertFails(getDoc(doc(db, appliancePath(second, secondAppliance))));
  }
});
test("Appliance rules: duplicate brand/serial across customers cannot steal a reservation", async () => {
  const { second } = await seedAppliances();
  await assertFails(createClientAppliance(customerClient("cm-admin"), second, "duplicate-serial", sampleAppliance("SERIAL-1")));
});
test("Appliance rules: serial reservation is required and arbitrary ownership fields are rejected", async () => {
  const { first } = await seedAppliances();
  const db = customerClient("cm-admin");
  const data = { ...sampleAppliance("SERIAL-3"), createdAt: serverTimestamp(), createdBy: "cm-admin", updatedAt: serverTimestamp(), updatedBy: "cm-admin" };
  await assertFails(setDoc(doc(db, appliancePath(first, "missing-key")), data));
  const batch = writeBatch(db);
  batch.set(doc(db, appliancePath(first, "forged-owner")), { ...data, ownerUid: "victim" });
  batch.set(doc(db, "applianceKeys/serial_test brand|SERIAL-3"), { customerId: first, applianceId: "forged-owner" });
  await assertFails(batch.commit());
});
test("Appliance rules: Admin cannot create under a nonexistent parent or delete appliances", async () => {
  const { first, firstAppliance } = await seedAppliances();
  const db = customerClient("cm-admin");
  await assertFails(createClientAppliance(db, "missing-customer", "orphan", sampleAppliance("SERIAL-3")));
  await assertFails(deleteDoc(doc(db, appliancePath(first, firstAppliance))));
});
test("Appliance rules: type, date order and creation audit fields are protected", async () => {
  const { first, firstAppliance } = await seedAppliances();
  const db = customerClient("cm-admin");
  await assertFails(createClientAppliance(db, first, "bad-type", { ...sampleAppliance("SERIAL-3"), type: "fridge" }));
  await assertFails(createClientAppliance(db, first, "bad-dates", { ...sampleAppliance("SERIAL-4"), installationDate: "2025-01-01" }));
  await assertFails(updateDoc(doc(db, appliancePath(first, firstAppliance)), { createdBy: "forged", updatedAt: serverTimestamp(), updatedBy: "cm-admin" }));
});
test("Appliance rules: optional serial permits records without a reservation", async () => {
  const { first } = await seedAppliances();
  await assertSucceeds(createClientAppliance(customerClient("cm-admin"), first, "no-serial", sampleAppliance("")));
});
test("Appliance rules: later linking a parent customer automatically grants only its owner read access", async () => {
  await seedCustomerFixtures();
  const unlinked = await saveCustomer(adminDb, sampleCustomer("unlinked@example.invalid", "9876543212"), { operatorUid: "cm-admin" });
  const id = await saveAppliance(adminDb, unlinked, sampleAppliance("UNLINKED"), { operatorUid: "cm-admin" });
  await adminDb.doc("users/cm-linked").set({ role: "customer", active: true });
  await assertFails(getDoc(doc(customerClient("cm-linked"), appliancePath(unlinked, id))));
  await saveCustomer(adminDb, sampleCustomer("unlinked@example.invalid", "9876543212"), { operatorUid: "cm-admin", resolvedOwnerUid: "cm-linked", id: unlinked });
  await assertSucceeds(getDoc(doc(customerClient("cm-linked"), appliancePath(unlinked, id))));
  await assertFails(getDoc(doc(customerClient("cm-b"), appliancePath(unlinked, id))));
});
test("Appliance store: simultaneous duplicate brand/serial across customers yields one winner", async () => {
  const { first, second } = await seedAppliances();
  const results = await Promise.allSettled([
    saveAppliance(adminDb, first, sampleAppliance("RACE"), { operatorUid: "cm-admin" }),
    saveAppliance(adminDb, second, sampleAppliance("RACE"), { operatorUid: "cm-admin" }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
});
test("Appliance store: inactive serial stays reserved; same serial in a different brand is allowed", async () => {
  const { first, firstAppliance, second } = await seedAppliances();
  await saveAppliance(adminDb, first, { ...sampleAppliance("SERIAL-1"), active: false }, { operatorUid: "cm-admin", id: firstAppliance });
  await assert.rejects(saveAppliance(adminDb, second, sampleAppliance("SERIAL-1"), { operatorUid: "cm-admin" }), error => error.code === "duplicate-serial");
  await saveAppliance(adminDb, second, sampleAppliance("SERIAL-1", "Other Brand"), { operatorUid: "cm-admin" });
});
test("Appliance store: serial edit releases old key and preserves creation metadata", async () => {
  const { first, firstAppliance, second } = await seedAppliances();
  const path = appliancePath(first, firstAppliance);
  const before = (await adminDb.doc(path).get()).data();
  await saveAppliance(adminDb, first, sampleAppliance("UPDATED"), { operatorUid: "cm-admin", id: firstAppliance });
  const after = (await adminDb.doc(path).get()).data();
  assert.equal(after.createdAt.toMillis(), before.createdAt.toMillis());
  assert.equal(after.createdBy, before.createdBy);
  assert.equal((await adminDb.doc("applianceKeys/serial_test brand|SERIAL-1").get()).exists, false);
  await saveAppliance(adminDb, second, sampleAppliance("SERIAL-1"), { operatorUid: "cm-admin" });
});
test("Appliance store: parent changes and non-Admin writes cannot alter appliances", async () => {
  const { first, firstAppliance, second } = await seedAppliances();
  await assert.rejects(saveAppliance(adminDb, first, sampleAppliance("FORGED"), { operatorUid: "cm-a", id: firstAppliance }), error => error.code === "forbidden");
  await assert.rejects(saveAppliance(adminDb, second, sampleAppliance("TRANSFER"), { operatorUid: "cm-admin", id: firstAppliance }), error => error.code === "not-found");
  await assert.rejects(saveAppliance(adminDb, "missing", sampleAppliance("ORPHAN"), { operatorUid: "cm-admin" }), error => error.code === "not-found");
});

async function seedRequests() {
  const fixtures = await seedAppliances();
  const id = await createServiceRequest(adminDb, requestInput(fixtures), "cm-a");
  return { ...fixtures, requestId: id };
}
function requestInput(fixture, overrides = {}) {
  return { customerId: fixture.first, applianceId: fixture.firstAppliance, serviceType: "repair", description: "TEST: Water is leaking from the unit.", ...overrides };
}
test("Request store: Customer creates own request with trusted pending status, identity and labels", async () => {
  const f = await seedAppliances();
  const id = await createServiceRequest(adminDb, requestInput(f, { status: "completed", createdBy: "forged", customerName: "forged" }), "cm-a");
  const data = (await adminDb.doc("serviceRequests/" + id).get()).data();
  assert.equal(data.status, "pending"); assert.equal(data.createdBy, "cm-a"); assert.notEqual(data.customerName, "forged");
  assert.ok(data.createdAt.toMillis() > 0); assert.equal(data.applianceLabel, "Test Brand Test Model");
});
test("Request store: Admin creates a request for another customer's appliance", async () => {
  const f = await seedAppliances();
  await createServiceRequest(adminDb, requestInput(f, { customerId:f.second, applianceId:f.secondAppliance }), "cm-admin");
});
test("Request store: other-customer appliance, Technician and inactive operator are denied", async () => {
  const f = await seedAppliances();
  for (const actor of ["cm-b","cm-tech","cm-inactive"]) {
    await assert.rejects(createServiceRequest(adminDb,requestInput(f),actor),e=>e.code==="forbidden");
  }
  await assert.rejects(createServiceRequest(adminDb,requestInput(f,{applianceId:f.secondAppliance}),"cm-a"),e=>e.code==="not-found");
});
test("Request store: inactive customer or appliance and missing parents cannot create requests", async () => {
  const f = await seedAppliances();
  await adminDb.doc("customers/"+f.first).update({active:false});
  await assert.rejects(createServiceRequest(adminDb,requestInput(f),"cm-a"),e=>e.code==="inactive");
  await adminDb.doc("customers/"+f.first).update({active:true});
  await adminDb.doc(appliancePath(f.first,f.firstAppliance)).update({active:false});
  await assert.rejects(createServiceRequest(adminDb,requestInput(f),"cm-a"),e=>e.code==="inactive");
  await assert.rejects(createServiceRequest(adminDb,requestInput(f,{customerId:"missing"}),"cm-admin"),e=>e.code==="not-found");
});
test("Request store: concurrent duplicates produce one open request and one reservation", async () => {
  const f = await seedAppliances();
  const results=await Promise.allSettled([createServiceRequest(adminDb,requestInput(f),"cm-a"),createServiceRequest(adminDb,requestInput(f),"cm-admin")]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal((await adminDb.collection("serviceRequests").get()).size,1);
  assert.equal((await adminDb.collection("serviceRequestKeys").get()).size,1);
});
test("Request store: different service types can coexist and open duplicate is denied", async () => {
  const f=await seedRequests();
  await assert.rejects(createServiceRequest(adminDb,requestInput(f),"cm-a"),e=>e.code==="duplicate");
  await createServiceRequest(adminDb,requestInput(f,{serviceType:"maintenance"}),"cm-a");
});
test("Request store: Admin progresses pending to in progress to completed, retaining creation data", async () => {
  const f=await seedRequests();
  await assignTechnician(adminDb,assignmentAuth,f.requestId,"cm-tech",0,"cm-admin");
  const before=(await adminDb.doc("serviceRequests/"+f.requestId).get()).data();
  await updateServiceRequestStatus(adminDb, f.requestId, "in_progress", "pending", "cm-admin", assignmentAuth);
  await assert.rejects(createServiceRequest(adminDb,requestInput(f),"cm-a"),e=>e.code==="duplicate");
  await updateServiceRequestStatus(adminDb,f.requestId,"completed","in_progress","cm-admin",undefined,"TEST: Admin verified completed service work.");
  const after=(await adminDb.doc("serviceRequests/"+f.requestId).get()).data();
  assert.equal(after.status,"completed"); assert.equal(after.createdBy,before.createdBy);assert.equal(after.createdAt.toMillis(),before.createdAt.toMillis());
  assert.equal(after.updatedBy,"cm-admin");assert.equal(after.description,before.description);
  assert.equal((await adminDb.collection("serviceRequestKeys").get()).size,0);
  await createServiceRequest(adminDb,requestInput(f),"cm-a");
});
test("Request store: skipped, stale and terminal status changes are denied", async () => {
  const f=await seedRequests();
  await assignTechnician(adminDb,assignmentAuth,f.requestId,"cm-tech",0,"cm-admin");
  await assert.rejects(updateServiceRequestStatus(adminDb,f.requestId,"completed","pending","cm-admin",undefined,"TEST: Admin verified completed service work."),e=>e.code==="transition");
  await updateServiceRequestStatus(adminDb, f.requestId, "in_progress", "pending", "cm-admin", assignmentAuth);
  await assert.rejects(updateServiceRequestStatus(adminDb,f.requestId,"cancelled","pending","cm-admin"),e=>e.code==="conflict");
  await updateServiceRequestStatus(adminDb,f.requestId,"cancelled","in_progress","cm-admin");
  await assert.rejects(updateServiceRequestStatus(adminDb,f.requestId,"in_progress","cancelled","cm-admin"),e=>e.code==="transition");
});
test("Request store: cancellation releases reservation without changing other requests", async () => {
  const f=await seedRequests();
  await updateServiceRequestStatus(adminDb,f.requestId,"cancelled","pending","cm-admin");
  const next=await createServiceRequest(adminDb,requestInput(f),"cm-a");
  assert.notEqual(next,f.requestId);assert.equal((await adminDb.collection("serviceRequests").get()).size,2);
});
test("Request store: Customer and Technician cannot update progress", async () => {
  const f=await seedRequests();
  for(const actor of ["cm-a","cm-tech","cm-inactive"]) await assert.rejects(updateServiceRequestStatus(adminDb,f.requestId,"in_progress","pending",actor),e=>e.code==="forbidden");
});
test("Request store: concurrent Admin changes cannot silently overwrite progress", async () => {
  const f=await seedRequests();
  await assignTechnician(adminDb,assignmentAuth,f.requestId,"cm-tech",0,"cm-admin");
  const results=await Promise.allSettled([updateServiceRequestStatus(adminDb, f.requestId, "in_progress", "pending", "cm-admin", assignmentAuth),updateServiceRequestStatus(adminDb,f.requestId,"cancelled","pending","cm-admin")]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(results.filter(r=>r.status==="rejected"&&r.reason.code==="conflict").length,1);
});
test("Request rules: Admin reads all and Customer reads only own requests using constrained queries", async () => {
  const f=await seedRequests();
  const other=await createServiceRequest(adminDb,requestInput(f,{customerId:f.second,applianceId:f.secondAppliance}),"cm-admin");
  const own=customerClient("cm-a");
  await assertSucceeds(getDoc(doc(own,"serviceRequests/"+f.requestId)));
  await assertSucceeds(getDocs(query(collection(own,"serviceRequests"),where("customerId","==",f.first))));
  await assertFails(getDoc(doc(own,"serviceRequests/"+other)));
  await assertFails(getDocs(collection(own,"serviceRequests")));
  await assertSucceeds(getDocs(collection(customerClient("cm-admin"),"serviceRequests")));
});
test("Request rules: Technician, unauthenticated, unverified, inactive and forged Admin claims denied",async()=>{
  const f=await seedRequests();
  for(const db of [customerClient("cm-tech"),environment.unauthenticatedContext().firestore(),customerClient("cm-admin",false),customerClient("cm-inactive"),customerClient("cm-b",true,{role:"admin"})]){
    await assertFails(getDoc(doc(db,"serviceRequests/"+f.requestId)));
  }
});
test("Request rules: even authorized readers cannot bypass server writes or read reservations",async()=>{
  const f=await seedRequests();
  for(const uid of ["cm-admin","cm-a","cm-tech"]){
    const db=customerClient(uid);
    await assertFails(setDoc(doc(db,"serviceRequests/client-forged"),{customerId:f.first,status:"pending"}));
    await assertFails(updateDoc(doc(db,"serviceRequests/"+f.requestId),{status:"completed"}));
    await assertFails(deleteDoc(doc(db,"serviceRequests/"+f.requestId)));
    await assertFails(getDocs(collection(db,"serviceRequestKeys")));
    await assertFails(setDoc(doc(db,"serviceRequestKeys/forged"),{requestId:f.requestId}));
  }
});
test("Request store validates hostile inputs independently of the API",async()=>{
  const f=await seedAppliances();
  for(const overrides of [{description:"x"},{serviceType:"constructor"},{customerId:"../victim"},{applianceId:"bad/path"}]) {
    await assert.rejects(createServiceRequest(adminDb,requestInput(f,overrides),"cm-a"),e=>e.code==="invalid");
  }
  assert.equal((await adminDb.collection("serviceRequests").get()).size,0);
});

const assignmentAuth = { getUser: async uid => ({ uid, disabled: false, emailVerified: true, displayName: "Synthetic Technician" }) };
async function seedAssignments() {
  const fixture = await seedRequests();
  await adminDb.doc("users/cm-tech").update({ displayName: "Technician One" });
  await adminDb.doc("users/cm-tech-2").set({ role: "technician", active: true, displayName: "Technician Two" });
  return fixture;
}
test("Assignment store: Admin assigns verified active Technician and preserves request data", async () => {
  const f = await seedAssignments();
  const before = (await adminDb.doc("serviceRequests/" + f.requestId).get()).data();
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin");
  const after = (await adminDb.doc("serviceRequests/" + f.requestId).get()).data();
  assert.equal(after.assignedTechnicianUid, "cm-tech"); assert.equal(after.assignedTechnicianName, "Technician One");
  assert.equal(after.assignmentVersion, 1); assert.equal(after.assignedBy, "cm-admin"); assert.ok(after.assignmentUpdatedAt.toMillis() > 0);
  assert.equal(after.status, "pending"); assert.equal(after.description, before.description); assert.equal(after.customerId, before.customerId);
  assert.equal(after.createdBy, before.createdBy); assert.equal(after.createdAt.toMillis(), before.createdAt.toMillis());
  assert.equal((await adminDb.collection("serviceRequestKeys").get()).size, 1);
});
test("Assignment store: Customer, Technician and inactive Admin cannot assign", async () => {
  const f = await seedAssignments();
  for (const actor of ["cm-a", "cm-tech", "cm-inactive"]) await assert.rejects(assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, actor), e => e.code === "forbidden");
});
test("Assignment store: non-Technician and inactive target profiles rejected", async () => {
  const f = await seedAssignments();
  await assert.rejects(assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-a", 0, "cm-admin"), e => e.code === "technician-unavailable");
  await adminDb.doc("users/cm-tech").update({ active: false });
  await assert.rejects(assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin"), e => e.code === "technician-unavailable");
});
test("Assignment store: disabled, unverified and missing Auth targets fail closed", async () => {
  const f = await seedAssignments();
  for (const account of [{ disabled: true, emailVerified: true }, { disabled: false, emailVerified: false }]) {
    await assert.rejects(assignTechnician(adminDb, { getUser: async () => account }, f.requestId, "cm-tech", 0, "cm-admin"), e => e.code === "technician-unavailable");
  }
  await assert.rejects(assignTechnician(adminDb, { getUser: async () => { throw { code: "auth/user-not-found" }; } }, f.requestId, "cm-tech", 0, "cm-admin"), e => e.code === "technician-unavailable");
  await assert.rejects(assignTechnician(adminDb, { getUser: async () => { throw new Error("Auth unavailable"); } }, f.requestId, "cm-tech", 0, "cm-admin"), /Auth unavailable/);
  assert.equal((await adminDb.doc("serviceRequests/" + f.requestId).get()).data().assignedTechnicianUid, null);
});
test("Assignment store: stale assignment versions and unchanged selections rejected", async () => {
  const f = await seedAssignments();
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin");
  await assert.rejects(assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech-2", 0, "cm-admin"), e => e.code === "conflict");
  await assert.rejects(assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 1, "cm-admin"), e => e.code === "assignment-unchanged");
});
test("Assignment rules: only assigned Technician reads request and constrained list", async () => {
  const f = await seedAssignments();
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin");
  const db = customerClient("cm-tech");
  await assertSucceeds(getDoc(doc(db, "serviceRequests/" + f.requestId)));
  await assertSucceeds(getDocs(query(collection(db, "serviceRequests"), where("assignedTechnicianUid", "==", "cm-tech"))));
  await assertFails(getDocs(collection(db, "serviceRequests")));
  await assertFails(getDoc(doc(customerClient("cm-tech-2"), "serviceRequests/" + f.requestId)));
  await assertSucceeds(getDoc(doc(customerClient("cm-a"), "serviceRequests/" + f.requestId)));
  await assertFails(getDoc(doc(customerClient("cm-b"), "serviceRequests/" + f.requestId)));
});
test("Assignment rules: reassignment revokes old Technician immediately", async () => {
  const f = await seedAssignments();
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin");
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech-2", 1, "cm-admin");
  await assertFails(getDoc(doc(customerClient("cm-tech"), "serviceRequests/" + f.requestId)));
  await assertSucceeds(getDoc(doc(customerClient("cm-tech-2"), "serviceRequests/" + f.requestId)));
  const oldList = await assertSucceeds(getDocs(query(collection(customerClient("cm-tech"), "serviceRequests"), where("assignedTechnicianUid", "==", "cm-tech"))));
  assert.equal(oldList.empty, true);
});
test("Assignment rules: unassignment revokes Technician without touching request status", async () => {
  const f = await seedAssignments();
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin");
  await assignTechnician(adminDb, assignmentAuth, f.requestId, null, 1, "cm-admin");
  await assertFails(getDoc(doc(customerClient("cm-tech"), "serviceRequests/" + f.requestId)));
  const data = (await adminDb.doc("serviceRequests/" + f.requestId).get()).data();
  assert.equal(data.assignmentVersion, 2); assert.equal(data.assignedTechnicianUid, null); assert.equal(data.assignedTechnicianName, ""); assert.equal(data.status, "pending");
});
test("Assignment rules: assigned Technician still cannot access customer, appliance or user directory", async () => {
  const f = await seedAssignments();
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin");
  const db = customerClient("cm-tech");
  await assertFails(getDoc(doc(db, "customers/" + f.first)));
  await assertFails(getDoc(doc(db, appliancePath(f.first, f.firstAppliance))));
  await assertFails(getDocs(collection(db, "users")));
  await assertFails(updateDoc(doc(db, "serviceRequests/" + f.requestId), { assignedTechnicianUid: "cm-tech-2" }));
  await assertFails(updateDoc(doc(db, "serviceRequests/" + f.requestId), { status: "completed" }));
});
test("Assignment rules: inactive/unverified technician and forged role cannot read assigned work", async () => {
  const f = await seedAssignments();
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin");
  await assertFails(getDoc(doc(customerClient("cm-tech", false), "serviceRequests/" + f.requestId)));
  await assertFails(getDoc(doc(customerClient("cm-tech-2", true, { role: "admin" }), "serviceRequests/" + f.requestId)));
  await adminDb.doc("users/cm-tech").update({ active: false });
  await assertFails(getDoc(doc(customerClient("cm-tech"), "serviceRequests/" + f.requestId)));
});
test("Assignment store: concurrent assignments produce one winner", async () => {
  const f = await seedAssignments();
  const results = await Promise.allSettled([
    assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin"),
    assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech-2", 0, "cm-admin"),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected" && r.reason.code === "conflict").length, 1);
});
test("Assignment store: started and closed requests cannot be reassigned; history remains readable", async () => {
  const f = await seedAssignments();
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin");
  await updateServiceRequestStatus(adminDb, f.requestId, "in_progress", "pending", "cm-admin", assignmentAuth);
  await assert.rejects(assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech-2", 1, "cm-admin"), e => e.code === "assignment-closed");
  await updateServiceRequestStatus(adminDb, f.requestId, "completed", "in_progress", "cm-admin",undefined,"TEST: Admin verified completed service work.");
  await assert.rejects(assignTechnician(adminDb, assignmentAuth, f.requestId, null, 1, "cm-admin"), e => e.code === "assignment-closed");
  await assertSucceeds(getDoc(doc(customerClient("cm-tech"), "serviceRequests/" + f.requestId)));
});
test("Assignment store: malformed inputs and missing request rejected", async () => {
  await seedAssignments();
  await assert.rejects(assignTechnician(adminDb, assignmentAuth, "missing", "cm-tech", 0, "cm-admin"), e => e.code === "not-found");
  for (const [uid, version] of [["../victim",0],["cm-tech",-1],["cm-tech",0.2]]) await assert.rejects(assignTechnician(adminDb, assignmentAuth, "request", uid, version, "cm-admin"), e => e.code === "invalid");
});
test("Assignment store: legacy requests can be assigned without migrating records", async () => {
  const f = await seedAssignments();
  await adminDb.doc("serviceRequests/" + f.requestId).update({ assignedTechnicianUid: FieldValue.delete(), assignedTechnicianName: FieldValue.delete(), assignmentVersion: FieldValue.delete() });
  await assertFails(getDoc(doc(customerClient("cm-tech"), "serviceRequests/" + f.requestId)));
  await assignTechnician(adminDb, assignmentAuth, f.requestId, "cm-tech", 0, "cm-admin");
  await assertSucceeds(getDoc(doc(customerClient("cm-tech"), "serviceRequests/" + f.requestId)));
});

test("Work guard: unassigned requests cannot start or complete", async () => {
  const f = await seedRequests();
  await assert.rejects(updateServiceRequestStatus(adminDb,f.requestId,"in_progress","pending","cm-admin",assignmentAuth),e=>e.code==="assignment-required");
  assert.equal((await adminDb.doc("serviceRequests/"+f.requestId).get()).data().status,"pending");
  await adminDb.doc("serviceRequests/"+f.requestId).update({status:"in_progress"});
  await assert.rejects(updateServiceRequestStatus(adminDb,f.requestId,"completed","in_progress","cm-admin",assignmentAuth,"TEST: Admin verified completed service work."),e=>e.code==="assignment-required");
});
test("Work guard: inactive, disabled and unverified assigned technicians cannot start work", async () => {
  const f = await seedAssignments();
  await assignTechnician(adminDb,assignmentAuth,f.requestId,"cm-tech",0,"cm-admin");
  await adminDb.doc("users/cm-tech").update({active:false});
  await assert.rejects(updateServiceRequestStatus(adminDb,f.requestId,"in_progress","pending","cm-admin",assignmentAuth),e=>e.code==="technician-unavailable");
  await adminDb.doc("users/cm-tech").update({active:true});
  for(const account of [{disabled:true,emailVerified:true},{disabled:false,emailVerified:false}]) {
    await assert.rejects(updateServiceRequestStatus(adminDb,f.requestId,"in_progress","pending","cm-admin",{getUser:async()=>account}),e=>e.code==="technician-unavailable");
  }
  await assert.rejects(updateServiceRequestStatus(adminDb,f.requestId,"in_progress","pending","cm-admin",{getUser:async()=>{throw new Error("Auth unavailable");}}),/Auth unavailable/);
  assert.equal((await adminDb.doc("serviceRequests/"+f.requestId).get()).data().status,"pending");
});
test("Work guard: unassigned legacy In-progress request accepts one eligible assignment without resetting status", async () => {
  const f = await seedAssignments();
  await adminDb.doc("serviceRequests/"+f.requestId).update({status:"in_progress"});
  const before=(await adminDb.doc("serviceRequests/"+f.requestId).get()).data();
  await assignTechnician(adminDb,assignmentAuth,f.requestId,"cm-tech",0,"cm-admin");
  const after=(await adminDb.doc("serviceRequests/"+f.requestId).get()).data();
  assert.equal(after.status,"in_progress");assert.equal(after.assignedTechnicianUid,"cm-tech");
  assert.equal(after.createdAt.toMillis(),before.createdAt.toMillis());assert.equal(after.description,before.description);
  await assert.rejects(assignTechnician(adminDb,assignmentAuth,f.requestId,"cm-tech-2",1,"cm-admin"),e=>e.code==="assignment-closed");
  await updateServiceRequestStatus(adminDb,f.requestId,"completed","in_progress","cm-admin",assignmentAuth,"TEST: Admin verified completed service work.");
});
test("Work guard: assignment and starting work cannot race into an unassigned In-progress state", async () => {
  const f=await seedAssignments();
  await Promise.allSettled([
    assignTechnician(adminDb,assignmentAuth,f.requestId,"cm-tech",0,"cm-admin"),
    updateServiceRequestStatus(adminDb,f.requestId,"in_progress","pending","cm-admin",assignmentAuth),
  ]);
  const data=(await adminDb.doc("serviceRequests/"+f.requestId).get()).data();
  assert.ok(data.status!=="in_progress"||data.assignedTechnicianUid==="cm-tech");
  assert.equal(data.assignedTechnicianUid,"cm-tech");
});

async function seedWork() {
  const f=await seedAssignments();
  await assignTechnician(adminDb,assignmentAuth,f.requestId,"cm-tech",0,"cm-admin");
  return f;
}
const workInput=(action,version=0,status="pending",notes="")=>({action,expectedVersion:version,expectedStatus:status,notes});
test("Technician work: assigned Technician starts, edits notes and completes atomically",async()=>{
  const f=await seedWork();
  const before=(await adminDb.doc("serviceRequests/"+f.requestId).get()).data();
  await updateTechnicianWork(adminDb,f.requestId,workInput("start"),"cm-tech");
  await updateTechnicianWork(adminDb,f.requestId,workInput("save_notes",1,"in_progress","Checked filter."),"cm-tech");
  await updateTechnicianWork(adminDb,f.requestId,workInput("complete",2,"in_progress","Replaced filter and verified operation."),"cm-tech");
  const request=(await adminDb.doc("serviceRequests/"+f.requestId).get()).data(),work=(await adminDb.doc("serviceWork/"+f.requestId).get()).data();
  assert.equal(request.status,"completed");assert.equal(request.updatedBy,"cm-tech");
  assert.equal(work.notes,"Replaced filter and verified operation.");assert.equal(work.version,3);assert.equal(work.updatedBy,"cm-tech");
  assert.equal(request.createdAt.toMillis(),before.createdAt.toMillis());assert.equal(request.description,before.description);assert.equal(request.assignedTechnicianUid,"cm-tech");
  assert.equal("notes" in request,false);assert.equal((await adminDb.collection("serviceRequestKeys").get()).size,0);
  await createServiceRequest(adminDb,requestInput(f),"cm-a");
});
test("Technician work: other roles, other Technician and inactive Technician cannot update",async()=>{
  const f=await seedWork();
  for(const actor of ["cm-admin","cm-a","cm-tech-2","missing-user"])await assert.rejects(updateTechnicianWork(adminDb,f.requestId,workInput("start"),actor),e=>e.code==="forbidden");
  await adminDb.doc("users/cm-tech").update({active:false});
  await assert.rejects(updateTechnicianWork(adminDb,f.requestId,workInput("start"),"cm-tech"),e=>e.code==="forbidden");
});
test("Technician work: pending cannot skip start; completion needs notes",async()=>{
  const f=await seedWork();
  await assert.rejects(updateTechnicianWork(adminDb,f.requestId,workInput("save_notes"),"cm-tech"),e=>e.code==="transition");
  await assert.rejects(updateTechnicianWork(adminDb,f.requestId,workInput("complete",0,"pending","Done."),"cm-tech"),e=>e.code==="transition");
  await updateTechnicianWork(adminDb,f.requestId,workInput("start"),"cm-tech");
  await assert.rejects(updateTechnicianWork(adminDb,f.requestId,workInput("complete",1,"in_progress","  "),"cm-tech"),e=>e.code==="notes-required");
  assert.equal((await adminDb.doc("serviceRequests/"+f.requestId).get()).data().status,"in_progress");
});
test("Technician work: stale versions and concurrent notes updates cannot overwrite saved notes",async()=>{
  const f=await seedWork();
  await updateTechnicianWork(adminDb,f.requestId,workInput("start"),"cm-tech");
  const results=await Promise.allSettled([
    updateTechnicianWork(adminDb,f.requestId,workInput("save_notes",1,"in_progress","First edit."),"cm-tech"),
    updateTechnicianWork(adminDb,f.requestId,workInput("save_notes",1,"in_progress","Second edit."),"cm-tech"),
  ]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(results.filter(r=>r.status==="rejected"&&r.reason.code==="conflict").length,1);
});
test("Technician work: reassignment or removal revokes update access",async()=>{
  const f=await seedWork();
  await assignTechnician(adminDb,assignmentAuth,f.requestId,"cm-tech-2",1,"cm-admin");
  await assert.rejects(updateTechnicianWork(adminDb,f.requestId,workInput("start"),"cm-tech"),e=>e.code==="forbidden");
  await assignTechnician(adminDb,assignmentAuth,f.requestId,null,2,"cm-admin");
  await assert.rejects(updateTechnicianWork(adminDb,f.requestId,workInput("start"),"cm-tech-2"),e=>e.code==="forbidden");
});
test("Technician work: completion and cancellation close note editing",async()=>{
  const f=await seedWork();
  await updateTechnicianWork(adminDb,f.requestId,workInput("start"),"cm-tech");
  await updateServiceRequestStatus(adminDb,f.requestId,"cancelled","in_progress","cm-admin");
  await assert.rejects(updateTechnicianWork(adminDb,f.requestId,workInput("save_notes",1,"in_progress","Late edit."),"cm-tech"),e=>e.code==="conflict");
});
test("Technician work: malformed notes and missing request produce no writes",async()=>{
  const f=await seedWork();
  for(const changes of [{notes:"x".repeat(2001)},{notes:123},{action:"cancel"},{expectedVersion:-1}]){
    await assert.rejects(updateTechnicianWork(adminDb,f.requestId,{...workInput("start"),...changes},"cm-tech"),e=>e.code==="invalid");
  }
  await assert.rejects(updateTechnicianWork(adminDb,"missing",workInput("start"),"cm-tech"),e=>e.code==="forbidden");
  assert.equal((await adminDb.collection("serviceWork").get()).size,0);
});
test("Work notes rules: Admin and assigned Technician read; Customer sees progress but not notes",async()=>{
  const f=await seedWork();
  await updateTechnicianWork(adminDb,f.requestId,workInput("start",0,"pending","Internal service note."),"cm-tech");
  const path="serviceWork/"+f.requestId;
  await assertSucceeds(getDoc(doc(customerClient("cm-admin"),path)));
  await assertSucceeds(getDoc(doc(customerClient("cm-tech"),path)));
  for(const db of [customerClient("cm-a"),customerClient("cm-b"),customerClient("cm-tech-2"),environment.unauthenticatedContext().firestore(),customerClient("cm-tech",false)]){
    await assertFails(getDoc(doc(db,path)));
  }
  await assertSucceeds(getDoc(doc(customerClient("cm-a"),"serviceRequests/"+f.requestId)));
  for(const uid of ["cm-admin","cm-tech","cm-a"]){
    const db=customerClient(uid);
    await assertFails(updateDoc(doc(db,path),{notes:"Forged"}));
    await assertFails(setDoc(doc(db,"serviceWork/forged"),{notes:"Forged"}));
    await assertFails(deleteDoc(doc(db,path)));
  }
});
test("Work notes rules: unassigned or inactive Technician loses read access",async()=>{
  const f=await seedWork();
  await updateTechnicianWork(adminDb,f.requestId,workInput("start",0,"pending","Test notes."),"cm-tech");
  await adminDb.doc("users/cm-tech").update({active:false});
  await assertFails(getDoc(doc(customerClient("cm-tech"),"serviceWork/"+f.requestId)));
  await adminDb.doc("users/cm-tech").update({active:true});
  await adminDb.doc("serviceRequests/"+f.requestId).update({assignedTechnicianUid:null});
  await assertFails(getDoc(doc(customerClient("cm-tech"),"serviceWork/"+f.requestId)));
});

const samplePackage=(changes={})=>({name:"TEST Maintenance",applianceType:"water_purifier",serviceType:"maintenance",pricePaise:49900,description:"Synthetic maintenance offering.",active:true,...changes});
async function seedPackages(){
  await seedCustomerFixtures();
  const active=await saveServicePackage(adminDb,samplePackage(),{operatorUid:"cm-admin"});
  const inactive=await saveServicePackage(adminDb,samplePackage({name:"TEST Inactive",active:false}),{operatorUid:"cm-admin"});
  return {active,inactive};
}
test("Package store: Admin creates/edits exact prices and preserves creation metadata",async()=>{
  const id=await (async()=>{await seedCustomerFixtures();return saveServicePackage(adminDb,samplePackage(),{operatorUid:"cm-admin"});})();
  const before=(await adminDb.doc("servicePackages/"+id).get()).data();
  await saveServicePackage(adminDb,samplePackage({pricePaise:59999,createdBy:"forged"}),{operatorUid:"cm-admin",id,expectedVersion:1});
  const after=(await adminDb.doc("servicePackages/"+id).get()).data();
  assert.equal(after.pricePaise,59999);assert.equal(after.version,2);assert.equal(after.createdBy,"cm-admin");assert.equal(after.createdAt.toMillis(),before.createdAt.toMillis());
});
test("Package rules: Admin reads all, Customer reads/query active packages only",async()=>{
  const f=await seedPackages(),db=customerClient("cm-a"),admin=customerClient("cm-admin");
  await assertSucceeds(getDoc(doc(admin,"servicePackages/"+f.inactive)));
  await assertSucceeds(getDocs(collection(admin,"servicePackages")));
  await assertSucceeds(getDoc(doc(db,"servicePackages/"+f.active)));
  await assertSucceeds(getDocs(query(collection(db,"servicePackages"),where("active","==",true))));
  await assertFails(getDoc(doc(db,"servicePackages/"+f.inactive)));
  await assertFails(getDocs(collection(db,"servicePackages")));
});
test("Package rules: Technician, anonymous, unverified, inactive and forged claims denied",async()=>{
  const f=await seedPackages();
  for(const db of [customerClient("cm-tech"),environment.unauthenticatedContext().firestore(),customerClient("cm-a",false),customerClient("cm-inactive"),customerClient("cm-tech",true,{role:"admin"})]){
    await assertFails(getDoc(doc(db,"servicePackages/"+f.active)));
  }
});
test("Package rules: direct client writes are denied, including Admin writes",async()=>{
  const f=await seedPackages();
  for(const uid of ["cm-admin","cm-a","cm-tech"]){
    const db=customerClient(uid);
    await assertFails(setDoc(doc(db,"servicePackages/forged"),samplePackage()));
    await assertFails(updateDoc(doc(db,"servicePackages/"+f.active),{pricePaise:1}));
    await assertFails(deleteDoc(doc(db,"servicePackages/"+f.active)));
  }
});
test("Package store: Customer, Technician and inactive Admin cannot write",async()=>{
  await seedPackages();
  for(const uid of ["cm-a","cm-tech","cm-inactive"])await assert.rejects(saveServicePackage(adminDb,samplePackage(),{operatorUid:uid}),e=>e.code==="forbidden");
});
test("Package store: malformed prices, types and fields fail before writes",async()=>{
  await seedCustomerFixtures();
  for(const change of [{pricePaise:1.5},{pricePaise:-1},{pricePaise:100000001},{applianceType:"fridge"},{active:"true"},{name:" "},{description:""}]){
    await assert.rejects(saveServicePackage(adminDb,samplePackage(change),{operatorUid:"cm-admin"}),e=>e.code==="invalid");
  }
  assert.equal((await adminDb.collection("servicePackages").get()).size,0);
});
test("Package store: concurrent edits cannot silently overwrite a newer version",async()=>{
  const {active}=await seedPackages();
  const results=await Promise.allSettled([
    saveServicePackage(adminDb,samplePackage({pricePaise:60000}),{operatorUid:"cm-admin",id:active,expectedVersion:1}),
    saveServicePackage(adminDb,samplePackage({pricePaise:70000}),{operatorUid:"cm-admin",id:active,expectedVersion:1}),
  ]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(results.filter(r=>r.status==="rejected"&&r.reason.code==="conflict").length,1);
});
test("Package store: deactivation hides catalogue record and missing edits do not create records",async()=>{
  const {active}=await seedPackages();
  await saveServicePackage(adminDb,samplePackage({active:false}),{operatorUid:"cm-admin",id:active,expectedVersion:1});
  await assertFails(getDoc(doc(customerClient("cm-a"),"servicePackages/"+active)));
  await assert.rejects(saveServicePackage(adminDb,samplePackage(),{operatorUid:"cm-admin",id:"missing",expectedVersion:1}),e=>e.code==="not-found");
});

const includedPlanInput=(changes={})=>({name:"TEST Two included visits",startsOn:"2020-01-01",expiresOn:"2090-12-31",packageId:null,expectedLatestPlanId:null,...changes});
async function seedIncludedPlan() {
  const f=await seedAppliances();
  const planId=await createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput(),"cm-admin");
  return {...f,planId};
}
function planPath(f,id=f.planId){return appliancePath(f.first,f.firstAppliance)+"/servicePlans/"+id;}
async function makePlanRequest(f,serviceType="maintenance",extra={}){
  return createServiceRequest(adminDb,{customerId:f.first,applianceId:f.firstAppliance,serviceType,description:"TEST: Included service plan verification.",...extra},"cm-a");
}
async function finishPlanRequest(f,id){
  await assignTechnician(adminDb,assignmentAuth,id,"cm-tech",0,"cm-admin");
  await updateServiceRequestStatus(adminDb,id,"in_progress","pending","cm-admin",assignmentAuth);
  await updateServiceRequestStatus(adminDb,id,"completed","in_progress","cm-admin",assignmentAuth,"TEST: Admin verified completed service work.");
}
test("Appliance plan: Admin creates a fixed two-visit allowance with no initial usage",async()=>{
  const f=await seedIncludedPlan(),data=(await adminDb.doc(planPath(f)).get()).data();
  assert.equal(data.totalServices,2);assert.equal(data.usedServices,0);assert.equal(data.createdBy,"cm-admin");assert.equal(data.renewedFrom,null);
  assert.equal((await adminDb.doc(appliancePath(f.first,f.firstAppliance)+"/servicePlanState/latest").get()).data().latestPlanId,f.planId);
});
test("Appliance plan: simultaneous initial plans produce one winner",async()=>{
  const f=await seedAppliances();
  const results=await Promise.allSettled([createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput(),"cm-admin"),createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput(),"cm-admin")]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(results.filter(r=>r.status==="rejected"&&r.reason.code==="conflict").length,1);
});
test("Appliance plan: renewal preserves prior history, starts after inclusive expiry and never carries usage",async()=>{
  const f=await seedIncludedPlan();
  await adminDb.doc(planPath(f)).update({usedServices:1});
  await assert.rejects(createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({startsOn:"2090-12-31",expiresOn:"2091-12-31",expectedLatestPlanId:f.planId}),"cm-admin"),e=>e.code==="overlap");
  const next=await createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({startsOn:"2091-01-01",expiresOn:"2091-12-31",expectedLatestPlanId:f.planId}),"cm-admin");
  const renewal=(await adminDb.doc(planPath(f,next)).get()).data();
  assert.equal(renewal.usedServices,0);assert.equal(renewal.totalServices,2);assert.equal(renewal.renewedFrom,f.planId);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,1);
  await assert.rejects(createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({startsOn:"2092-01-01",expiresOn:"2092-12-31",expectedLatestPlanId:f.planId}),"cm-admin"),e=>e.code==="conflict");
  const request=await makePlanRequest(f);
  assert.equal((await adminDb.doc("serviceRequests/"+request).get()).data().servicePlanId,f.planId);
});
test("Appliance plan: Customer and Technician cannot create or renew plans",async()=>{
  const f=await seedAppliances();
  for(const actor of ["cm-a","cm-tech","cm-inactive"])await assert.rejects(createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput(),actor),e=>e.code==="forbidden");
});
test("Appliance plan: inactive/missing parents and invalid date periods fail closed",async()=>{
  const f=await seedAppliances();
  await assert.rejects(createAppliancePlan(adminDb,"missing",f.firstAppliance,includedPlanInput(),"cm-admin"),e=>e.code==="not-found");
  await assert.rejects(createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({expiresOn:"2019-12-31"}),"cm-admin"),e=>e.code==="invalid");
  await adminDb.doc(appliancePath(f.first,f.firstAppliance)).update({active:false});
  await assert.rejects(createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput(),"cm-admin"),e=>e.code==="inactive");
});
test("Appliance plan: optional catalogue source is checked and copied as a stable name",async()=>{
  const f=await seedAppliances();
  for(const change of [{active:false},{serviceType:"installation"},{applianceType:"ac"}]){
    const packageId=await saveServicePackage(adminDb,samplePackage(change),{operatorUid:"cm-admin"});
    await assert.rejects(createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({packageId}),"cm-admin"),e=>e.code==="package-unavailable");
  }
  const packageId=await saveServicePackage(adminDb,samplePackage(),{operatorUid:"cm-admin"});
  const id=await createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({packageId,name:"Forged package name"}),"cm-admin");
  const plan=(await adminDb.doc(planPath(f,id)).get()).data();
  assert.equal(plan.name,"TEST Maintenance");assert.equal(plan.packageId,packageId);assert.equal("pricePaise" in plan,false);
  await saveServicePackage(adminDb,samplePackage({name:"Changed catalogue name"}),{operatorUid:"cm-admin",id:packageId,expectedVersion:1});
  assert.equal((await adminDb.doc(planPath(f,id)).get()).data().name,"TEST Maintenance");
});
test("Plan usage: requests and starting work do not deduct; Admin completion deducts once",async()=>{
  const f=await seedIncludedPlan(),id=await makePlanRequest(f);
  const request=(await adminDb.doc("serviceRequests/"+id).get()).data();
  assert.equal(request.servicePlanId,f.planId);assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
  await assignTechnician(adminDb,assignmentAuth,id,"cm-tech",0,"cm-admin");
  await updateServiceRequestStatus(adminDb,id,"in_progress","pending","cm-admin",assignmentAuth);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
  await updateServiceRequestStatus(adminDb,id,"completed","in_progress","cm-admin",assignmentAuth,"TEST: Admin verified completed service work.");
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,1);
  assert.equal((await adminDb.doc("serviceRequests/"+id).get()).data().servicePlanCreditUsed,true);
  await assert.rejects(updateServiceRequestStatus(adminDb,id,"completed","in_progress","cm-admin",assignmentAuth,"TEST: Admin verified completed service work."),e=>e.code==="conflict");
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,1);
});
test("Plan usage: Technician completion uses the same allowance and the third visit is not included",async()=>{
  const f=await seedIncludedPlan(),first=await makePlanRequest(f);
  await finishPlanRequest(f,first);
  const second=await makePlanRequest(f);
  await assignTechnician(adminDb,assignmentAuth,second,"cm-tech",0,"cm-admin");
  await updateTechnicianWork(adminDb,second,workInput("start"),"cm-tech");
  await updateTechnicianWork(adminDb,second,workInput("complete",1,"in_progress","TEST: Maintenance completed."),"cm-tech");
  const plan=(await adminDb.doc(planPath(f)).get()).data();
  assert.equal(plan.usedServices,2);assert.equal(planBalance(plan).remainingServices,0);
  const third=await makePlanRequest(f);
  assert.equal((await adminDb.doc("serviceRequests/"+third).get()).data().servicePlanId,undefined);
});
test("Plan usage: installation, repairs and cancellations never consume maintenance visits",async()=>{
  const f=await seedIncludedPlan();
  for(const type of ["installation","repair"]){
    const id=await makePlanRequest(f,type,{servicePlanId:"forged",servicePlanCreditUsed:true});
    assert.equal((await adminDb.doc("serviceRequests/"+id).get()).data().servicePlanId,undefined);
    await finishPlanRequest(f,id);
  }
  const maintenance=await makePlanRequest(f);
  await updateServiceRequestStatus(adminDb,maintenance,"cancelled","pending","cm-admin");
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
  assert.equal((await adminDb.collection(planPath(f)+"/visits").get()).size,0);
});
test("Plan usage: expiry before completion does not consume expired or renewed allowances",async()=>{
  const f=await seedIncludedPlan(),id=await makePlanRequest(f);
  await adminDb.doc(planPath(f)).update({startsOn:"2010-01-01",expiresOn:"2011-12-31"});
  const renewed=await createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({expectedLatestPlanId:f.planId}),"cm-admin");
  await finishPlanRequest(f,id);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
  assert.equal((await adminDb.doc(planPath(f,renewed)).get()).data().usedServices,0);
  const request=(await adminDb.doc("serviceRequests/"+id).get()).data();
  assert.equal(request.servicePlanOutcome,"expired");assert.equal(request.servicePlanCreditUsed,false);assert.equal(request.status,"completed");
  assert.equal(planBalance((await adminDb.doc(planPath(f)).get()).data()).expiredServices,2);
});
test("Plan usage: expired and future plans do not cover a newly created request",async()=>{
  const f=await seedAppliances();
  await createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({startsOn:"2010-01-01",expiresOn:"2011-12-31"}),"cm-admin");
  const id=await makePlanRequest(f);
  assert.equal((await adminDb.doc("serviceRequests/"+id).get()).data().servicePlanId,undefined);
  await updateServiceRequestStatus(adminDb,id,"cancelled","pending","cm-admin");
  const latest=(await adminDb.doc(appliancePath(f.first,f.firstAppliance)+"/servicePlanState/latest").get()).data().latestPlanId;
  await createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({startsOn:"2090-01-01",expiresOn:"2091-01-01",expectedLatestPlanId:latest}),"cm-admin");
  const future=await makePlanRequest(f);
  assert.equal((await adminDb.doc("serviceRequests/"+future).get()).data().servicePlanId,undefined);
});
test("Plan usage: Admin and Technician completion race cannot double-deduct",async()=>{
  const f=await seedIncludedPlan(),id=await makePlanRequest(f);
  await assignTechnician(adminDb,assignmentAuth,id,"cm-tech",0,"cm-admin");
  await updateTechnicianWork(adminDb,id,workInput("start"),"cm-tech");
  const results=await Promise.allSettled([
    updateServiceRequestStatus(adminDb,id,"completed","in_progress","cm-admin",assignmentAuth,"TEST: Admin verified completed service work."),
    updateTechnicianWork(adminDb,id,workInput("complete",1,"in_progress","TEST: Completed."),"cm-tech"),
  ]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,1);
  assert.equal((await adminDb.collection(planPath(f)+"/visits").get()).size,1);
});
test("Plan usage: final credit cannot be overdrawn and redemption replay is idempotent",async()=>{
  const f=await seedIncludedPlan();
  await adminDb.doc(planPath(f)).update({usedServices:1});
  const request={customerId:f.first,applianceId:f.firstAppliance,serviceType:"maintenance",servicePlanId:f.planId};
  const redeem=id=>adminDb.runTransaction(async tx=>(await preparePlanCompletion(tx,adminDb,request,id,"cm-admin"))());
  const results=await Promise.all([redeem("race-a"),redeem("race-b")]);
  assert.equal(results.filter(r=>r.servicePlanCreditUsed).length,1);assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,2);
  const visit=(await adminDb.collection(planPath(f)+"/visits").get()).docs[0];
  await redeem(visit.id);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,2);
});
test("Plan rules: only Admin and the owning Customer read plan periods/history",async()=>{
  const f=await seedIncludedPlan(),path=planPath(f);
  for(const uid of ["cm-admin","cm-a"]){
    const db=customerClient(uid);await assertSucceeds(getDoc(doc(db,path)));await assertSucceeds(getDocs(collection(db,appliancePath(f.first,f.firstAppliance)+"/servicePlans")));
  }
  for(const db of [customerClient("cm-b"),customerClient("cm-tech"),environment.unauthenticatedContext().firestore(),customerClient("cm-a",false)]){
    await assertFails(getDoc(doc(db,path)));
  }
});
test("Plan rules: direct allowance writes, redemptions and plan state access stay denied",async()=>{
  const f=await seedIncludedPlan();
  for(const uid of ["cm-admin","cm-a","cm-tech"]){
    const db=customerClient(uid);
    await assertFails(updateDoc(doc(db,planPath(f)),{usedServices:-1,totalServices:999}));
    await assertFails(setDoc(doc(db,planPath(f)+"/visits/forged"),{requestId:"forged"}));
    await assertFails(deleteDoc(doc(db,planPath(f))));
    await assertFails(getDoc(doc(db,appliancePath(f.first,f.firstAppliance)+"/servicePlanState/latest")));
  }
});

test("Customer free booking: requires a valid available allowance and never falls back silently",async()=>{
  const f=await seedIncludedPlan();
  await adminDb.doc(planPath(f)).update({startsOn:"2010-01-01",expiresOn:"2011-12-31"});
  await assert.rejects(makePlanRequest(f,"maintenance",{useIncludedVisit:true}),e=>e.code==="plan-unavailable");
  await adminDb.doc(planPath(f)).update({startsOn:"2020-01-01",expiresOn:"2090-12-31",usedServices:2});
  await assert.rejects(makePlanRequest(f,"maintenance",{useIncludedVisit:true}),e=>e.code==="plan-unavailable");
  await adminDb.doc(planPath(f)).update({startsOn:"2090-01-01",expiresOn:"2091-12-31",usedServices:0});
  await assert.rejects(makePlanRequest(f,"maintenance",{useIncludedVisit:true}),e=>e.code==="plan-unavailable");
  assert.equal((await adminDb.collection("serviceRequests").get()).size,0);
});
test("Customer free booking: linked own request is accepted and only completion uses the visit",async()=>{
  const f=await seedIncludedPlan(),id=await makePlanRequest(f,"maintenance",{useIncludedVisit:true,servicePlanId:"forged-plan"});
  assert.equal((await adminDb.doc("serviceRequests/"+id).get()).data().servicePlanId,f.planId);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
  await finishPlanRequest(f,id);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,1);
});
test("Customer complaints: can report own appliance faults without consuming free maintenance",async()=>{
  const f=await seedIncludedPlan();
  const id=await makePlanRequest(f,"repair",{useIncludedVisit:false});
  await finishPlanRequest(f,id);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
  await assert.rejects(makePlanRequest(f,"repair",{useIncludedVisit:true}),e=>e.code==="invalid");
  await assert.rejects(createServiceRequest(adminDb,{customerId:f.second,applianceId:f.secondAppliance,serviceType:"maintenance",description:"TEST: Forbidden free service request.",useIncludedVisit:true},"cm-a"),e=>e.code==="forbidden");
});

import { lifecycleAction } from "../scripts/lifecycle-store.mjs";
import { enqueue,dispatchNotification,notificationId,applyDelivery } from "../scripts/whatsapp-outbox.mjs";
import { runLifecycleJobs } from "../scripts/lifecycle-jobs.mjs";
async function seedManaged(){
  const f=await seedAppliances();
  await adminDb.doc(appliancePath(f.first,f.firstAppliance)).update({installationDate:"2026-11-15"});
  const packageId=await saveServicePackage(adminDb,samplePackage({policy:{validityMonths:12,maintenanceIntervalMonths:6}}),{operatorUid:"cm-admin"});
  const planId=await createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({packageId}),"cm-admin",{managed:true});
  return {...f,planId,packageId};
}
async function offer(f){return lifecycleAction(adminDb,"cm-admin",{action:"propose",customerId:f.first,applianceId:f.firstAppliance,packageId:f.packageId});}
test("Lifecycle: managed initial period ignores client dates and snapshots package policy with two due records",async()=>{
  const f=await seedManaged(),p=(await adminDb.doc(planPath(f)).get()).data();
  assert.equal(p.startsOn,"2026-11-15");assert.equal(p.expiresOn,"2027-11-15");assert.equal(p.usedServices,0);
  const rows=(await adminDb.collection("maintenanceSchedule").get()).docs.map(d=>d.data());
  assert.deepEqual(rows.map(r=>r.dueOn).sort(),["2027-05-15","2027-11-15"]);
  assert.equal(rows.every(r=>r.status==="due"&&!r.appointmentAt),true);
});
test("Lifecycle: no installation or package policy cannot create a managed initial period",async()=>{
  const f=await seedAppliances();
  await adminDb.doc(appliancePath(f.first,f.firstAppliance)).update({installationDate:""});
  await assert.rejects(createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput(),"cm-admin",{managed:true}),e=>e.code==="policy-required");
  const packageId=await saveServicePackage(adminDb,samplePackage({policy:{validityMonths:12,maintenanceIntervalMonths:6}}),{operatorUid:"cm-admin"});
  await assert.rejects(createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({packageId}),"cm-admin",{managed:true}),e=>e.code==="installation-required");
});
test("Lifecycle: direct managed renewal cannot bypass customer agreement",async()=>{
  const f=await seedManaged();
  await assert.rejects(createAppliancePlan(adminDb,f.first,f.firstAppliance,includedPlanInput({packageId:f.packageId,startsOn:"2028-01-01",expiresOn:"2029-01-01",expectedLatestPlanId:f.planId}),"cm-admin",{managed:true}),e=>e.code==="approval-required");
});
test("Lifecycle: maintenance completion updates exactly one due record in its redemption transaction",async()=>{
  const f=await seedManaged(),id=await makePlanRequest(f);await finishPlanRequest(f,id);
  const rows=(await adminDb.collection("maintenanceSchedule").get()).docs.map(d=>d.data());
  assert.equal(rows.filter(r=>r.status==="completed").length,1);assert.equal(rows.find(r=>r.status==="completed").requestId,id);
});
test("Renewal: only owner can agree; Admin cannot self-approve or confirm before agreement",async()=>{
  const f=await seedManaged(),id=await offer(f),input={action:"agree",id,expectedVersion:1};
  for(const uid of ["cm-b","cm-tech"]){await assert.rejects(lifecycleAction(adminDb,uid,input),e=>e.code==="forbidden");await assert.rejects(lifecycleAction(adminDb,uid,{...input,expectedVersion:999}),e=>e.code==="forbidden");}
  await assert.rejects(lifecycleAction(adminDb,"cm-admin",input),e=>e.code==="transition");
  await assert.rejects(lifecycleAction(adminDb,"cm-admin",{...input,action:"confirm"}),e=>e.code==="transition");
});
test("Renewal: agreement and concurrent confirmations create one new period and preserve prior usage/history",async()=>{
  const f=await seedManaged(),id=await offer(f);
  await adminDb.doc(planPath(f)).update({usedServices:1});
  await lifecycleAction(adminDb,"cm-a",{action:"agree",id,expectedVersion:1});
  const results=await Promise.allSettled([1,2].map(()=>lifecycleAction(adminDb,"cm-admin",{action:"confirm",id,expectedVersion:2})));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  const renewal=(await adminDb.doc("renewals/"+id).get()).data(),next=(await adminDb.doc(planPath(f,renewal.planId)).get()).data();
  assert.equal(next.renewedFrom,f.planId);assert.equal(next.usedServices,0);assert.equal(next.totalServices,2);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,1);
  assert.equal((await adminDb.collection(appliancePath(f.first,f.firstAppliance)+"/servicePlans").get()).size,2);
});
test("Renewal: concurrent proposals serialize; decline releases reservation; stale terms cannot confirm",async()=>{
  const f=await seedManaged(),results=await Promise.allSettled([offer(f),offer(f)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);const id=results.find(r=>r.status==="fulfilled").value;
  await lifecycleAction(adminDb,"cm-a",{action:"decline",id,expectedVersion:1});
  const newer=await offer(f);await lifecycleAction(adminDb,"cm-a",{action:"agree",id:newer,expectedVersion:1});
  await saveServicePackage(adminDb,samplePackage({policy:{validityMonths:24,maintenanceIntervalMonths:6}}),{operatorUid:"cm-admin",id:f.packageId,expectedVersion:1});
  await assert.rejects(lifecycleAction(adminDb,"cm-admin",{action:"confirm",id:newer,expectedVersion:2}),e=>e.code==="package-changed");
  await lifecycleAction(adminDb,"cm-admin",{action:"cancel",id:newer,expectedVersion:2});
  assert.ok(await offer(f));
});
test("Lifecycle rules: own Customer and Admin read schedules and renewals; others and all client writes are denied",async()=>{
  const f=await seedManaged(),id=await offer(f),schedule=(await adminDb.collection("maintenanceSchedule").get()).docs[0].id;
  for(const path of ["renewals/"+id,"maintenanceSchedule/"+schedule]){
    for(const uid of ["cm-admin","cm-a"])await assertSucceeds(getDoc(doc(customerClient(uid),path)));
    for(const db of [customerClient("cm-b"),customerClient("cm-tech"),customerClient("cm-inactive"),environment.unauthenticatedContext().firestore()])await assertFails(getDoc(doc(db,path)));
    for(const uid of ["cm-admin","cm-a","cm-tech"])await assertFails(updateDoc(doc(customerClient(uid),path),{status:"confirmed"}));
  }
});
const notice={kind:"maintenance",startsOn:"2026-11-15",expiresOn:"2027-11-15",sourceKey:"synthetic-plan_1",parameters:["TEST Care","2027-05-15","test-reference"]};
async function consentNotice(f,uid="cm-a"){
  await lifecycleAction(adminDb,uid,{action:"consent",phone:"+919876501234",enabled:true});
  const event={...notice,customerId:f.first};await enqueue(adminDb,event,uid);
  return notificationId(event.kind,event.sourceKey,uid);
}
const sendSettings={maxAttempts:3,retryMinutes:2,language:"en_US",templates:{maintenance:"test_care"}};
const sendConfig={token:"synthetic-only",phoneId:"123",apiVersion:"v27.0"};
const verifiedAuth={getUser:async()=>({disabled:false,emailVerified:true})};
test("Consent and outbox: no opt-in means no queue; parallel replay creates exactly one notification per recipient",async()=>{
  const f=await seedManaged(),event={...notice,customerId:f.first};
  assert.equal(await enqueue(adminDb,event,"cm-a"),false);
  await lifecycleAction(adminDb,"cm-a",{action:"consent",phone:"+919876501234",enabled:true});
  const results=await Promise.all([enqueue(adminDb,event,"cm-a"),enqueue(adminDb,event,"cm-a")]);
  assert.equal(results.filter(Boolean).length,1);assert.equal(await enqueue(adminDb,event,"cm-b"),false);
});
test("Consent withdrawal and disabled Auth prevent sends without touching quota",async()=>{
  const f=await seedManaged(),id=await consentNotice(f);let sends=0;
  await lifecycleAction(adminDb,"cm-a",{action:"consent",phone:"",enabled:false});
  await dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,async()=>{sends++;});
  assert.equal(sends,0);assert.equal((await adminDb.doc("notifications/"+id).get()).data().status,"suppressed");
  const f2=await seedManaged(),id2=await consentNotice(f2);
  await dispatchNotification(adminDb,{getUser:async()=>({disabled:true,emailVerified:true})},id2,sendSettings,sendConfig,async()=>{sends++;});
  assert.equal(sends,0);
});
test("Notification: concurrent dispatch accepts once; only signed-handler delivery application promotes delivery; replay is idempotent",async()=>{
  const f=await seedManaged(),id=await consentNotice(f);let calls=0;
  const send=async(url,options)=>{calls++;assert.equal(url,"https://graph.facebook.com/v27.0/123/messages");const body=JSON.parse(options.body);assert.equal(body.recipient_type,"individual");assert.equal(body.biz_opaque_callback_data,id);assert.equal(body.template.components[0].parameters.length,3);return Response.json({messages:[{id:"wamid.synthetic"}]});};
  await Promise.all([dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,send),dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,send)]);
  assert.equal(calls,1);assert.equal((await adminDb.doc("notifications/"+id).get()).data().status,"accepted");
  const status={id:"wamid.synthetic",status:"delivered",timestamp:"1800000000",biz_opaque_callback_data:id};
  assert.equal(await applyDelivery(adminDb,status),true);assert.equal(await applyDelivery(adminDb,status),false);
  await applyDelivery(adminDb,{...status,status:"sent",timestamp:"1799999999"});
  assert.equal((await adminDb.doc("notifications/"+id).get()).data().status,"delivered");
});
test("Notification retries: definite rate-limit retries respect configured delay; ambiguous network failures are not resent",async()=>{
  const f=await seedManaged(),id=await consentNotice(f);let calls=0;const clock=Date.now();
  const send=async()=>{calls++;return new Response("",{status:429});};
  await dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,send,clock);
  assert.equal((await adminDb.doc("notifications/"+id).get()).data().status,"retry");
  await dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,send,clock+1);assert.equal(calls,1);
  await dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,async()=>{calls++;throw Error("synthetic timeout");},clock+120000);
  assert.equal((await adminDb.doc("notifications/"+id).get()).data().status,"uncertain");
  await dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,send,clock+9999999);assert.equal(calls,2);
});
test("Job replay: disabled configuration causes no work; repeated scans deduplicate notifications",async()=>{
  const f=await seedManaged(),id=await consentNotice(f);
  const disabled=await runLifecycleJobs(adminDb,verifiedAuth,{});assert.equal(disabled.enabled,false);
  await adminDb.doc("settings/serviceAutomation").set({enabled:true,maintenanceLeadDays:365,expiryLeadDays:365,overdueRepeatDays:14,retryMinutes:2,maxAttempts:3,language:"en_US",templates:{maintenance:"test_care",expiry:"test_expiry"}});
  await runLifecycleJobs(adminDb,verifiedAuth,{});const count=(await adminDb.collection("notifications").get()).size;
  await runLifecycleJobs(adminDb,verifiedAuth,{});assert.equal((await adminDb.collection("notifications").get()).size,count);
  assert.equal((await adminDb.doc("notifications/"+id).get()).data().status,"queued");
});
test("Lifecycle private rules: followups Admin-only; notification recipients isolated; consent and job metadata never client-writable",async()=>{
  const f=await seedManaged(),id=await consentNotice(f);
  await adminDb.doc("serviceFollowups/test").set({customerId:f.first,notes:"Private"});
  await assertSucceeds(getDoc(doc(customerClient("cm-admin"),"serviceFollowups/test")));
  await assertFails(getDoc(doc(customerClient("cm-a"),"serviceFollowups/test")));
  await assertSucceeds(getDoc(doc(customerClient("cm-a"),"notifications/"+id)));
  await assertFails(getDoc(doc(customerClient("cm-b"),"notifications/"+id)));
  for(const path of ["notificationConsents/cm-a","notifications/"+id,"automationCursors/maintenanceSchedule","renewalLocks/test","notificationEvents/test","settings/serviceAutomation"]){
    for(const uid of ["cm-admin","cm-a","cm-tech"])await assertFails(setDoc(doc(customerClient(uid),path),{enabled:true,status:"delivered"}));
  }
});

test("Lifecycle follow-ups/settings: Customer, Technician and inactive Admin cannot manage automation or follow-ups",async()=>{
  const f=await seedManaged();
  const actions=[{action:"followup",requestId:"missing",dueOn:"2027-05-15",notes:"Synthetic follow-up",closed:false},
    {action:"settings",enabled:true}];
  for(const uid of ["cm-a","cm-tech","cm-inactive"])for(const input of actions)
    await assert.rejects(lifecycleAction(adminDb,uid,input),e=>e.code==="forbidden");
  await assert.rejects(lifecycleAction(adminDb,"cm-admin",{action:"consent",enabled:true,phone:"123"}),e=>e.code==="invalid");
  assert.equal((await adminDb.collection("maintenanceSchedule").get()).size,2);
  assert.ok(f.planId);
});
test("Service event history: request creation, assignment and completion are atomically preserved for scheduled notifications",async()=>{
  const f=await seedManaged(),id=await makePlanRequest(f);await finishPlanRequest(f,id);
  const events=(await adminDb.collection("serviceEvents").where("requestId","==",id).get()).docs.map(d=>d.data());
  assert.deepEqual(events.map(e=>e.event).sort(),["assignment_1","created","status_completed","status_in_progress"]);
  assert.equal(events.every(e=>e.customerId===f.first&&/^202[0-9]-/.test(e.businessDate)),true);
});
test("Job lease: active runs are not duplicated and an expired lease can be recovered",async()=>{
  await seedManaged();
  await adminDb.doc("automationLocks/lifecycle").set({owner:"synthetic-other-run",until:Date.now()+60000});
  assert.equal((await runLifecycleJobs(adminDb,verifiedAuth,{})).busy,true);
  await adminDb.doc("automationLocks/lifecycle").set({owner:"expired",until:Date.now()-1});
  assert.equal((await runLifecycleJobs(adminDb,verifiedAuth,{})).enabled,false);
  assert.equal((await adminDb.doc("automationLocks/lifecycle").get()).exists,false);
});
test("Dispatch pause and delivery ordering: disabled automation sends nothing; late provider failure cannot undo delivery",async()=>{
  const f=await seedManaged(),id=await consentNotice(f);let calls=0;
  await adminDb.doc("settings/serviceAutomation").set({enabled:false});
  await dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,async()=>{calls++;return Response.json({messages:[{id:"wamid.pause"}]});});
  assert.equal(calls,0);assert.equal((await adminDb.doc("notifications/"+id).get()).data().status,"queued");
  await adminDb.doc("settings/serviceAutomation").set({enabled:true});
  await dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,async()=>Response.json({messages:[{id:"wamid.pause"}]}));
  await applyDelivery(adminDb,{id:"wamid.pause",status:"delivered",timestamp:"1800000000"});
  await applyDelivery(adminDb,{id:"wamid.pause",status:"failed",timestamp:"1800000001"});
  assert.equal((await adminDb.doc("notifications/"+id).get()).data().status,"delivered");
});

test("Defect regression: both completion paths require notes and leave request, plan and visit unchanged on failure",async()=>{
  const f=await seedManaged(),id=await makePlanRequest(f);
  await assignTechnician(adminDb,assignmentAuth,id,"cm-tech",0,"cm-admin");
  await updateTechnicianWork(adminDb,id,workInput("start"),"cm-tech");
  const before=(await adminDb.doc("serviceRequests/"+id).get()).data();
  await assert.rejects(updateServiceRequestStatus(adminDb,id,"completed","in_progress","cm-admin",assignmentAuth),e=>e.code==="notes-required");
  await assert.rejects(updateServiceRequestStatus(adminDb,id,"completed","in_progress","cm-admin",assignmentAuth,"  "),e=>e.code==="notes-required");
  await assert.rejects(updateTechnicianWork(adminDb,id,workInput("complete",1,"in_progress","  "),"cm-tech"),e=>e.code==="notes-required");
  assert.deepEqual((await adminDb.doc("serviceRequests/"+id).get()).data(),before);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
  assert.equal((await adminDb.collection(planPath(f)+"/visits").get()).size,0);
});

test("Defect regression: server-generated plan and visit linkage follows scheduled, requested, confirmed and completed stages",async()=>{
  const f=await seedManaged(),visitId=f.planId+"_1",path=planPath(f)+"/maintenanceVisits/"+visitId;
  assert.equal((await adminDb.doc(path).get()).data().status,"scheduled");
  const id=await makePlanRequest(f,"maintenance",{servicePlanId:"forged",visitId:"forged",useIncludedVisit:true});
  const request=(await adminDb.doc("serviceRequests/"+id).get()).data();
  assert.equal(request.schemaVersion,3);assert.equal(request.servicePlanId,f.planId);assert.equal(request.visitId,visitId);
  const linked=(await adminDb.doc(path).get()).data();
  assert.equal(linked.status,"requested");assert.equal(linked.requestId,id);assert.equal(linked.customerId,f.first);assert.equal(linked.applianceId,f.firstAppliance);
  await assignTechnician(adminDb,assignmentAuth,id,"cm-tech",0,"cm-admin");
  await updateTechnicianWork(adminDb,id,workInput("start"),"cm-tech");
  assert.equal((await adminDb.doc(path).get()).data().status,"confirmed");
  await updateTechnicianWork(adminDb,id,workInput("complete",1,"in_progress","TEST: Completed maintenance."),"cm-tech");
  assert.equal((await adminDb.doc(path).get()).data().status,"completed");
  assert.equal(Object.hasOwn((await adminDb.doc("serviceRequests/"+id).get()).data(),"completionNotes"),false);
  assert.equal((await adminDb.doc("serviceWork/"+id).get()).data().completedNotes,"TEST: Completed maintenance.");
  await assertFails(getDoc(doc(customerClient("cm-a"),"serviceWork/"+id)));
  assert.equal((await adminDb.doc("maintenanceSchedule/"+visitId).get()).data().workflowStatus,"completed");
  assert.equal((await adminDb.doc(planPath(f)+"/visits/"+id).get()).data().visitId,visitId);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,1);
});

test("Defect regression: concurrent completion attempts create one debit, visit completion and receipt",async()=>{
  const f=await seedManaged(),id=await makePlanRequest(f);
  await assignTechnician(adminDb,assignmentAuth,id,"cm-tech",0,"cm-admin");
  await updateTechnicianWork(adminDb,id,workInput("start"),"cm-tech");
  const results=await Promise.allSettled(Array.from({length:8},(_,index)=>index%2
    ?updateTechnicianWork(adminDb,id,workInput("complete",1,"in_progress","TEST: Concurrent maintenance."),"cm-tech")
    :updateServiceRequestStatus(adminDb,id,"completed","in_progress","cm-admin",assignmentAuth,"TEST: Concurrent maintenance.")));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,1);
  assert.equal((await adminDb.collection(planPath(f)+"/visits").get()).size,1);
  assert.equal((await adminDb.collection(planPath(f)+"/maintenanceVisits").where("status","==","completed").get()).size,1);
});

test("Defect regression: cancellation releases the same visit without debit and old request cannot consume it",async()=>{
  const f=await seedManaged(),first=await makePlanRequest(f),visitId=(await adminDb.doc("serviceRequests/"+first).get()).data().visitId;
  await updateServiceRequestStatus(adminDb,first,"cancelled","pending","cm-admin");
  const next=await makePlanRequest(f);
  assert.equal((await adminDb.doc("serviceRequests/"+next).get()).data().visitId,visitId);
  assert.equal((await adminDb.doc("serviceRequests/"+first).get()).data().visitId,visitId);
  await assert.rejects(updateServiceRequestStatus(adminDb,first,"completed","in_progress","cm-admin",assignmentAuth,"TEST: stale completion."),e=>e.code==="conflict");
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
});

test("Defect regression: cross-visit tampering cannot deduct a free credit",async()=>{
  const f=await seedManaged(),id=await makePlanRequest(f);
  await assignTechnician(adminDb,assignmentAuth,id,"cm-tech",0,"cm-admin");
  await updateTechnicianWork(adminDb,id,workInput("start"),"cm-tech");
  await adminDb.doc("serviceRequests/"+id).update({visitId:f.planId+"_2"});
  await assert.rejects(updateTechnicianWork(adminDb,id,workInput("complete",1,"in_progress","TEST: should fail."),"cm-tech"),e=>e.code==="linkage-review-required");
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
  assert.equal((await adminDb.doc("serviceRequests/"+id).get()).data().status,"in_progress");
});

test("Defect regression: an unlinked legacy request is never guessed onto an available plan",async()=>{
  const f=await seedIncludedPlan(),id=await makePlanRequest(f);
  await adminDb.doc("serviceRequests/"+id).update({schemaVersion:FieldValue.delete(),maintenanceCoverage:FieldValue.delete(),servicePlanId:FieldValue.delete(),visitId:FieldValue.delete()});
  await assignTechnician(adminDb,assignmentAuth,id,"cm-tech",0,"cm-admin");
  await updateServiceRequestStatus(adminDb,id,"in_progress","pending","cm-admin",assignmentAuth);
  await assert.rejects(updateServiceRequestStatus(adminDb,id,"completed","in_progress","cm-admin",assignmentAuth,"TEST: Legacy review needed."),e=>e.code==="linkage-review-required");
  assert.equal((await adminDb.doc(planPath(f)).get()).data().usedServices,0);
  assert.equal((await adminDb.doc("serviceRequests/"+id).get()).data().servicePlanId,undefined);
  assert.equal((await adminDb.doc("serviceRequests/"+id).get()).data().status,"in_progress");
});

test("Defect regression: canonical visit rules allow only owner/Admin reads and deny every direct client write",async()=>{
  const f=await seedManaged(),path=planPath(f)+"/maintenanceVisits/"+f.planId+"_1";
  for(const uid of ["cm-a","cm-admin"])await assertSucceeds(getDoc(doc(customerClient(uid),path)));
  for(const uid of ["cm-b","cm-tech"])await assertFails(getDoc(doc(customerClient(uid),path)));
  for(const uid of ["cm-admin","cm-a","cm-tech"]){
    await assertFails(updateDoc(doc(customerClient(uid),path),{status:"completed"}));
    await assertFails(deleteDoc(doc(customerClient(uid),path)));
  }
});

test("Defect regression: invalid frequency policy cannot change existing period or schedule history",async()=>{
  const f=await seedManaged(),before=(await adminDb.doc(planPath(f)).get()).data();
  const schedules=(await adminDb.collection("maintenanceSchedule").get()).docs.map(d=>d.data());
  await assert.rejects(saveServicePackage(adminDb,samplePackage({policy:{validityMonths:3,maintenanceIntervalMonths:6}}),{operatorUid:"cm-admin"}),e=>e.code==="schedule-conflict");
  assert.deepEqual((await adminDb.doc(planPath(f)).get()).data(),before);
  assert.deepEqual((await adminDb.collection("maintenanceSchedule").get()).docs.map(d=>d.data()),schedules);
});

test("Defect regression: renewal retains the full old period and creates two independent canonical visits once",async()=>{
  const f=await seedManaged(),before=(await adminDb.doc(planPath(f)).get()).data(),id=await offer(f);
  await lifecycleAction(adminDb,"cm-a",{action:"agree",id,expectedVersion:1});
  const results=await Promise.allSettled([1,2,3].map(()=>lifecycleAction(adminDb,"cm-admin",{action:"confirm",id,expectedVersion:2})));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.deepEqual((await adminDb.doc(planPath(f)).get()).data(),before);
  const renewed=(await adminDb.doc("renewals/"+id).get()).data().planId;
  assert.equal((await adminDb.collection(planPath(f,renewed)+"/maintenanceVisits").get()).size,2);
  assert.equal((await adminDb.doc(planPath(f,renewed)).get()).data().usedServices,0);
});

test("Defect regression: expired queued maintenance notices are suppressed before the mocked provider send",async()=>{
  const f=await seedManaged(),id=await consentNotice(f);let calls=0;
  await adminDb.doc("notifications/"+id).update({expiresOn:"2020-01-01"});
  await dispatchNotification(adminDb,verifiedAuth,id,sendSettings,sendConfig,async()=>{calls++;return Response.json({messages:[{id:"must-not-send"}]});});
  assert.equal(calls,0);assert.equal((await adminDb.doc("notifications/"+id).get()).data().status,"suppressed");
});
