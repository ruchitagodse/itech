import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { planBalance } from "../scripts/service-plan-dates.mjs";

function load(file, dependencies = {}) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, {
    module: testModule,
    exports: testModule.exports,
    require(name) {
      if (!(name in dependencies)) throw Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  });
  return testModule.exports;
}

const dataModule = load("src/lib/admin-appliances/data.ts");
const { matchesAppliance } = dataModule;

const sampleItem = {
  id: "app-1",
  customerId: "cust-1",
  customerName: "Ruchita Sharma",
  customerPhone: "+91 98765 43210",
  customerEmail: "ruchita@example.com",
  customerCity: "Pune",
  type: "ac",
  brand: "Daikin",
  model: "FTKF50",
  serialNumber: "DKN12345",
  purchaseDate: "2025-01-10",
  installationDate: "2025-01-15",
  notes: "2nd floor bedroom",
  active: true,
  createdAt: "2025-01-15T10:00:00Z",
  updatedAt: "2025-01-15T10:00:00Z",
  plan: {
    id: "plan-1",
    name: "Total AC Care",
    status: "active",
    startsOn: "2026-01-01",
    expiresOn: "2026-12-31",
    totalServices: 3,
    usedServices: 1,
    remainingServices: 2,
  },
};

test("matchesAppliance matches by brand, model, serial, customer, phone, city", () => {
  assert.equal(matchesAppliance(sampleItem, "daikin", "all", "all"), true);
  assert.equal(matchesAppliance(sampleItem, "FTKF50", "all", "all"), true);
  assert.equal(matchesAppliance(sampleItem, "DKN12345", "all", "all"), true);
  assert.equal(matchesAppliance(sampleItem, "Ruchita", "all", "all"), true);
  assert.equal(matchesAppliance(sampleItem, "98765", "all", "all"), true);
  assert.equal(matchesAppliance(sampleItem, "Pune", "all", "all"), true);
  assert.equal(matchesAppliance(sampleItem, "Voltas", "all", "all"), false);
});

test("matchesAppliance filters by appliance type correctly", () => {
  assert.equal(matchesAppliance(sampleItem, "", "ac", "all"), true);
  assert.equal(matchesAppliance(sampleItem, "", "water_purifier", "all"), false);
  assert.equal(matchesAppliance(sampleItem, "", "all", "all"), true);
});

test("matchesAppliance filters by coverage status correctly", () => {
  assert.equal(matchesAppliance(sampleItem, "", "all", "active"), true);
  assert.equal(matchesAppliance(sampleItem, "", "all", "expired"), false);
  assert.equal(matchesAppliance(sampleItem, "", "all", "none"), false);

  const itemNoPlan = { ...sampleItem, plan: null };
  assert.equal(matchesAppliance(itemNoPlan, "", "all", "none"), true);
  assert.equal(matchesAppliance(itemNoPlan, "", "all", "active"), false);

  const itemExpired = {
    ...sampleItem,
    plan: { ...sampleItem.plan, status: "expired" },
  };
  assert.equal(matchesAppliance(itemExpired, "", "all", "expired"), true);
  assert.equal(matchesAppliance(itemExpired, "", "all", "active"), false);

  const itemExhausted = {
    ...sampleItem,
    plan: { ...sampleItem.plan, status: "exhausted" },
  };
  assert.equal(matchesAppliance(itemExhausted, "", "all", "expired"), true);
});

function serverFixture() {
  let accessed = 0;
  const customerRows = [
    { id: "cust-1", fullName: "Alice Smith", phone: "9876543210", city: "Mumbai", active: true },
    { id: "cust-2", fullName: "Bob Jones", phone: "9123456789", city: "Delhi", active: true },
  ];

  const doc = (path, data) => ({
    id: path.split("/").at(-1),
    ref: {
      path,
      parent: { parent: { id: path.split("/")[1] } },
    },
    data: () => data,
  });

  const appliancesList = [
    doc("customers/cust-1/appliances/app-1", {
      type: "ac",
      brand: "Daikin",
      model: "FTKF50",
      serialNumber: "DKN123",
      installationDate: "2025-01-01",
      active: true,
      createdAt: { toDate: () => new Date("2025-01-01T10:00:00Z") },
    }),
    doc("customers/cust-1/appliances/app-2", {
      type: "water_purifier",
      brand: "Kent",
      model: "Grand Plus",
      serialNumber: "KNT456",
      installationDate: "2025-02-01",
      active: true,
      createdAt: { toDate: () => new Date("2025-02-01T10:00:00Z") },
    }),
    doc("customers/cust-2/appliances/app-3", {
      type: "ac",
      brand: "Voltas",
      model: "Inverter 1.5T",
      serialNumber: "VLT789",
      installationDate: "2025-03-01",
      active: true,
      createdAt: { toDate: () => new Date("2025-03-01T10:00:00Z") },
    }),
  ];

  const plansList = [
    doc("customers/cust-1/appliances/app-1/servicePlans/plan-1", {
      name: "AC Annual Plan",
      startsOn: "2026-01-01",
      expiresOn: "2026-12-31",
      totalServices: 2,
      usedServices: 0,
    }),
    doc("customers/cust-1/appliances/app-2/servicePlans/plan-2", {
      name: "RO AMC",
      startsOn: "2025-01-01",
      expiresOn: "2025-12-31",
      totalServices: 3,
      usedServices: 3,
    }),
  ];

  const documents = {
    customers: customerRows.map(c => doc("customers/" + c.id, c)),
    appliances: appliancesList,
    servicePlans: plansList,
  };

  const query = name => ({
    where() { return this; },
    orderBy() { return this; },
    limit() { return this; },
    async get() {
      return { docs: documents[name] || [] };
    },
  });

  class AccessError extends Error {
    constructor(status) {
      super("Denied");
      this.status = status;
    }
  }

  const serverModule = load("src/lib/admin-appliances/server.ts", {
    "server-only": {},
    "@/lib/firebase/admin": {
      adminServices() {
        accessed++;
        return { db: { collection: query, collectionGroup: query } };
      },
    },
    "@/lib/customers/server": {
      CustomerAccessError: AccessError,
      getCustomer: async (_prof, id) => customerRows.find(c => c.id === id) || null,
    },
    "@/lib/appliances/server": {
      getAppliance: async (_prof, custId, appId) => {
        const item = appliancesList.find(a => a.id === appId);
        if (!item) return null;
        return { id: item.id, customerId: custId, ...item.data() };
      },
    },
    "@/lib/service-plans/server": {
      listAppliancePlans: async () => ({ items: [], nextCursor: null }),
    },
    "@/lib/service-requests/server": {
      serviceRequestRecord: d => ({ id: d.id, ...d.data() }),
    },
    "@/lib/service-plans/data": {
      indiaDate: () => "2026-11-20",
      planBalance,
    },
    "./data": dataModule,
  });

  return { serverModule, accessed: () => accessed };
}

for (const role of ["customer", "technician", "superadmin", "guest"]) {
  test(`${role} cannot access adminApplianceInventory or adminApplianceDetail`, async () => {
    const { serverModule, accessed } = serverFixture();
    await assert.rejects(
      serverModule.adminApplianceInventory({ role }),
      e => e.status === 403
    );
    await assert.rejects(
      serverModule.adminApplianceDetail({ role }, "cust-1", "app-1"),
      e => e.status === 403
    );
    assert.equal(accessed(), 0);
  });
}

test("adminApplianceInventory calculates metrics and connects customer and plan correctly", async () => {
  const { serverModule } = serverFixture();
  const res = await serverModule.adminApplianceInventory({ role: "admin" });

  assert.equal(res.metrics.total, 3);
  assert.equal(res.metrics.ac, 2);
  assert.equal(res.metrics.waterPurifier, 1);
  assert.equal(res.metrics.activeCoverage, 1);
  assert.equal(res.metrics.expiredCoverage, 1);
  assert.equal(res.items.length, 3);

  const app1 = res.items.find(i => i.id === "app-1");
  assert.ok(app1);
  assert.equal(app1.customerName, "Alice Smith");
  assert.equal(app1.plan?.status, "active");
  assert.equal(app1.plan?.name, "AC Annual Plan");
});

test("adminApplianceDetail returns customer and appliance data", async () => {
  const { serverModule } = serverFixture();
  const detail = await serverModule.adminApplianceDetail({ role: "admin" }, "cust-1", "app-1");

  assert.ok(detail);
  assert.equal(detail.customer.fullName, "Alice Smith");
  assert.equal(detail.appliance.brand, "Daikin");
  assert.equal(detail.appliance.model, "FTKF50");
});
