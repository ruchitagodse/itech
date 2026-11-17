// Read-only inventory. This script has no migration/write mode.
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const project = process.argv[process.argv.indexOf("--project") + 1];
if (!process.argv.includes("--project") || project !== "blog-a893e" || project !== process.env.FIREBASE_PROJECT_ID
  || project !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw Error("Explicit matching development project --project blog-a893e is required.");
const app = initializeApp({ credential: cert({ projectId: project, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10)) }) }, "legacy-read-only-audit");
const db = getFirestore(app);
try {
  const snapshot = await db.collection("serviceRequests").limit(500).get(), legacy = [];
  for (const doc of snapshot.docs) {
    const request = doc.data();
    if (request.serviceType !== "maintenance" || request.servicePlanId && request.visitId) continue;
    const root = db.doc("customers/" + request.customerId + "/appliances/" + request.applianceId);
    const [appliance, plans] = await Promise.all([root.get(), root.collection("servicePlans").get()]);
    legacy.push({ requestId: doc.id, customerId: request.customerId, applianceId: request.applianceId,
      status: request.status, missingPlanId: !request.servicePlanId, missingVisitId: !request.visitId,
      applianceExists: appliance.exists, installationDateRecorded: !!appliance.data()?.installationDate,
      existingPlansForManualReviewOnly: plans.docs.map(plan => ({ id: plan.id, startsOn: plan.data().startsOn,
        expiresOn: plan.data().expiresOn, totalServices: plan.data().totalServices, usedServices: plan.data().usedServices })),
      action: "Manual decision required. No plan or visit is selected." });
  }
  console.log(JSON.stringify({ project, readOnly: true, scannedRequests: snapshot.size, capped: snapshot.size === 500, legacy }, null, 2));
} finally { await db.terminate(); await deleteApp(app); }
