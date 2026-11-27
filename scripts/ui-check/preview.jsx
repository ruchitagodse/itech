// Real presentation components with synthetic data, isolated from Next routes and Firebase.
import React from "react";
import { createRoot } from "react-dom/client";
import LoginPage from "../../src/app/login/page";
import "../../src/app/globals.scss";
import { WorkspaceShell } from "../../src/components/admin-dashboard/shell";
import { DashboardShell } from "../../src/components/dashboard-shell";
import { CustomerHomeFrame } from "../../src/components/customer-home/home-frame";
import { AdminOverview } from "../../src/components/admin-dashboard/overview";
import { CustomerDirectory } from "../../src/components/admin-customers/directory";
import { AdminCustomerDetails } from "../../src/components/admin-customers/details";
import { CustomerForm } from "../../src/components/customers/customer-form";
import { ApplianceInventory } from "../../src/components/admin-appliances/inventory";
import { AdminApplianceDetails } from "../../src/components/admin-appliances/details";
import { AdminApplianceForm } from "../../src/components/admin-appliances/form";
import { TechnicianDirectory } from "../../src/components/admin-technicians/directory";
import { TechnicianDetails } from "../../src/components/admin-technicians/details";
import { TechnicianCreateForm } from "../../src/components/admin-technicians/create-form";
import { CreateAccountForm } from "../../src/components/create-account-form";
import { RequestList } from "../../src/components/service-requests/request-list";
import { RequestDetails } from "../../src/components/service-requests/request-details";
import { RequestForm } from "../../src/components/service-requests/request-form";
import { TechnicianWorkForm } from "../../src/components/service-requests/technician-work-form";
import { PackageList } from "../../src/components/service-packages/package-list";
import { PackageForm } from "../../src/components/service-packages/package-form";
import { PlanForm } from "../../src/components/service-plans/plan-form";
import { AppliancePlans } from "../../src/components/service-plans/appliance-plans";
import { LifecycleOverview } from "../../src/components/lifecycle/overview";
import { TechnicianOverview } from "../../src/components/technician-overview";
import { CustomerHome } from "../../src/components/customer-home/dashboard";
import { CustomerApplianceList } from "../../src/components/customer-appliances/customer-appliance-list";
import { CustomerApplianceDetailsView } from "../../src/components/customer-appliances/customer-appliance-details";
import { CustomerRequestsView } from "../../src/components/customer-requests/customer-requests-view";
import { CustomerRequestTracker } from "../../src/components/customer-requests/customer-request-tracker";
import { CustomerRequestFormView } from "../../src/components/customer-requests/customer-request-form-view";
import { CustomerPackagesView } from "../../src/components/customer-packages/customer-packages-view";
import { CustomerPlansView } from "../../src/components/customer-plans/customer-plans-view";
import { CustomerProfileView } from "../../src/components/customer-profile/customer-profile-view";
import { CustomerLifecycleView } from "../../src/components/customer-lifecycle/customer-lifecycle-view";

const date = "2026-11-20T10:00:00.000Z";
const customer = { id: "customer-1", fullName: "Asha Sharma", phone: "9876543210", email: "asha@example.test", addressLine1: "Apartment 1204, Lakeview Residency", addressLine2: "Near Central Park", city: "Pune", state: "Maharashtra", postalCode: "411001", pincode: "411001", address: "Apartment 1204, Lakeview Residency", alternatePhone: "", notes: "Please call before visiting.", active: true, createdAt: date, updatedAt: date, linkedUserUid: "fixture-customer", relationships: { appliances: 2, activeAppliances: 2, activePlans: 1, pendingRequests: 1 } };
const appliance = { id: "appliance-1", customerId: customer.id, type: "water_purifier", brand: "Kent", model: "Grand Plus RO with Mineral Technology", serialNumber: "KENT-1234567890-ABCDEFGHIJKLMNOPQRSTUVWXYZ", purchaseDate: "2026-01-01", installationDate: "2026-01-05", notes: "Kitchen purifier. Call before arrival.", active: true, createdAt: date, updatedAt: date };
const plan = { id: "plan-1", name: "Annual comprehensive maintenance", status: "active", startsOn: "2026-01-05", expiresOn: "2027-01-04", totalServices: 2, usedServices: 1, remainingServices: 1, expiredServices: 0 };
const request = { id: "request-1", customerId: customer.id, customerName: customer.fullName, applianceId: appliance.id, applianceLabel: appliance.brand + " " + appliance.model, serviceType: "maintenance", status: "in_progress", description: "Please inspect the purifier and replace the filter if necessary. Water flow has reduced.", assignedTechnicianUid: "fixture-technician", assignedTechnicianName: "Vikram Singh", assignmentUpdatedAt: date, createdAt: date, updatedAt: date, schemaVersion: 3, version: 1 };
const requests = [request, { ...request, id: "request-2", status: "pending", serviceType: "repair" }, { ...request, id: "request-3", status: "completed" }];
const pkg = { id: "package-1", name: "Complete Water Purifier Care", applianceType: "water_purifier", serviceType: "maintenance", pricePaise: 249900, description: "Two maintenance visits\nFilter inspection and cleaning\nComplete performance check", active: true, policy: { validityMonths: 12, maintenanceIntervalMonths: 6 }, version: 1 };
const technician = { id: "fixture-technician", displayName: "Vikram Singh", email: "vikram@example.test", phone: "9876543211", status: "active", profileActive: true, emailVerified: true, signInDisabled: false, createdAt: date, workload: { assigned: 2, pending: 1, inProgress: 1, completed: 8 } };
const lifecycle = [{ id: "visit-1", customerId: customer.id, applianceId: appliance.id, customerName: customer.fullName, applianceLabel: request.applianceLabel, planName: plan.name, startsOn: plan.startsOn, expiresOn: plan.expiresOn, dueOn: "2026-12-05", status: "scheduled", workflowStatus: "scheduled", version: 1 }];
const renewals = [{ ...lifecycle[0], id: "renewal-1", status: "awaiting_customer", pricePaise: 249900 }, { ...lifecycle[0], id: "renewal-2", status: "agreed", pricePaise: 249900 }];
const overview = { customer, items: [{ appliance, current: plan, upcoming: null }], nextCursor: null };
const baseProfile = { uid: "fixture", displayName: "Asha Sharma", email: "asha@example.test" };
const profile = role => ({ ...baseProfile, role });
const emptyPage = { items: [], nextCursor: null };
window.__uiFixtures = { customer, appliance, plan, package: pkg, lifecycle, renewals };
window.__requests = [];
// All preview mutations terminate here. There are no live-data requests.
window.fetch = async (url, options) => { window.__requests.push({ url, body: options?.body ? JSON.parse(options.body) : null }); return { ok: window.__responseOK !== false, json: async () => window.__responseOK === false ? { error: "Fixture request failed. Please retry." } : { id: "fixture-saved", account: { uid: "fixture-created", email: "technician@example.test", role: "technician" }, items: [pkg], nextCursor: null } }; };
const forms = { customerId: customer.id, applianceId: appliance.id, customerName: customer.fullName, applianceLabel: request.applianceLabel, basePath: "/admin/service-requests" };
const adminData = { today: "2026-11-27", statuses: { pending: 3, in_progress: 2, completed: 8, cancelled: 1 }, activePlans: 10, customers: 12, technicians: 3, appliances: 18, pending: 3, inProgress: 2, completed: 8, cancelled: 1, total: 14, assigned: 2, unassigned: 1, expiring: 2, expired: 1, leadDays: 30, awaitingCustomer: 1, awaitingAdmin: 1, maintenance: lifecycle, renewals: [], events: [{ requestId: request.id, eventLabel: "Work started", createdAt: date, serviceType: "maintenance" }], recent: requests };
const screens = [
  ["login", "/login", () => LoginPage()],
  ["admin-request-pending", "/admin/service-requests/request-2", () => <RequestDetails item={{ ...requests[1], assignedTechnicianUid: null }} admin initialTechnicians={{ items: [{ ...technician, uid: technician.id }], nextCursor: null }} />],
  ["technician-start-work", "/technician/assignments/request-2", () => <TechnicianWorkForm id="request-2" status="pending" work={{ notes: "", version: 1 }} />],
  ["admin-overview", "/admin", () => <AdminOverview profile={profile("admin")} data={adminData} />],
  ["admin-customers", "/admin/customers", () => <CustomerDirectory query="" cursor="" data={{ items: [customer], metrics: { total: 12, appliances: 10, plans: 6, pending: 3 }, selected: "all", nextCursor: "next" }} />],
  ["admin-customer-detail", "/admin/customers/customer-1", () => <AdminCustomerDetails saved data={{ customer, appliances: [{ appliance, plans: { items: [plan], nextCursor: null } }], moreAppliances: false, history: requests }} />],
  ["admin-customer-new", "/admin/customers/new", () => <CustomerForm />],
  ["admin-customer-edit", "/admin/customers/customer-1/edit", () => <CustomerForm customer={customer} />],
  ["admin-appliances", "/admin/appliances", () => <ApplianceInventory data={{ items: [{ ...appliance, customerName: customer.fullName, customerPhone: customer.phone, customerEmail: customer.email, customerCity: customer.city, plan }], matched: 1, nextCursor: "next", cursor: "", query: "", typeFilter: "all", coverageFilter: "all", metrics: { total: 18, ac: 8, waterPurifier: 10, activeCoverage: 12, expiredCoverage: 2 } }} />],
  ["admin-appliance-detail", "/admin/customers/customer-1/appliances/appliance-1", () => <AdminApplianceDetails saved data={{ customer, appliance, plans: { items: [plan], nextCursor: null }, requests }} />],
  ["admin-appliance-new", "/admin/appliances/new", () => <AdminApplianceForm customerList={[{ id: customer.id, fullName: customer.fullName }]} />],
  ["admin-appliance-edit", "/admin/customers/customer-1/appliances/appliance-1/edit", () => <AdminApplianceForm customerId={customer.id} customerName={customer.fullName} appliance={appliance} />],
  ["admin-technicians", "/admin/technicians", () => <TechnicianDirectory data={{ items: [technician], query: "", status: "all", filter: "all", cursor: "", nextCursor: "next", matched: 1, metrics: { total: 3, assigned: 2, inProgress: 1, completed: 8 } }} />],
  ["admin-technician-detail", "/admin/technicians/fixture-technician", () => <TechnicianDetails cursors={{}} data={{ technician, pending: { items: [requests[1]], nextCursor: null }, progress: { items: [request], nextCursor: null }, completed: { items: [requests[2]], nextCursor: null } }} />],
  ["admin-technician-new", "/admin/technicians/new", () => <TechnicianCreateForm />],
  ["admin-account-new", "/admin/accounts/new", () => <CreateAccountForm />],
  ["admin-requests", "/admin/service-requests", () => <><h1>Service requests</h1><RequestList items={requests} basePath="/admin/service-requests" /></>],
  ["admin-request-detail", "/admin/service-requests/request-1", () => <RequestDetails item={request} admin initialTechnicians={{ items: [technician], nextCursor: null }} />],
  ["admin-request-new", "/admin/service-requests/new", () => <RequestForm {...forms} />],
  ["admin-packages", "/admin/service-packages", () => <PackageList admin items={[pkg]} />],
  ["admin-package-new", "/admin/service-packages/new", () => <PackageForm />],
  ["admin-package-edit", "/admin/service-packages/package-1/edit", () => <PackageForm item={pkg} />],
  ["admin-plan-new", "/admin/customers/customer-1/appliances/appliance-1/service-plans/new", () => <PlanForm customerId={customer.id} applianceId={appliance.id} applianceType={appliance.type} installationDate={appliance.installationDate} latest={null} />],
  ["admin-plan-history", "/admin/customers/customer-1/appliances/appliance-1", () => AppliancePlans({ profile: profile("admin"), customerId: customer.id, applianceId: appliance.id })],
  ...["maintenanceSchedule", "renewals", "serviceFollowups", "notifications"].map(view => ["admin-lifecycle-" + view, "/admin/lifecycle", () => LifecycleOverview({ profile: profile("admin"), search: { view } })]),
  ["technician-overview", "/technician", () => <TechnicianOverview profile={profile("technician")} items={requests} />],
  ["technician-assignments", "/technician/assignments", () => <><h1>My assigned work</h1><RequestList items={requests} basePath="/technician/assignments" assignedOnly /></>],
  ["technician-work", "/technician/assignments/request-1", () => <><RequestDetails item={request} admin={false} technician /><TechnicianWorkForm id={request.id} status="in_progress" work={{ notes: "", version: 1 }} /></>],
  ["customer-home", "/customer", () => <CustomerHome profile={profile("customer")} overview={overview} requests={requests} openRequests="2" schedule={lifecycle} moreSchedule={false} renewals={[]} />],
  ["customer-appliances", "/customer/appliances", () => <CustomerApplianceList {...overview} />],
  ["customer-appliance-detail", "/customer/appliances/appliance-1", () => <CustomerApplianceDetailsView appliance={appliance} currentPlan={plan} upcomingPlan={null} planHistory={[plan]} requests={requests} />],
  ["customer-requests", "/customer/service-requests", () => <CustomerRequestsView items={requests} nextCursor="next" />],
  ...["pending", "in_progress", "completed", "cancelled"].map(status => ["customer-tracker-" + status, "/customer/service-requests/request-1", () => <CustomerRequestTracker item={{ ...request, status }} saved />]),
  ["customer-request-new", "/customer/service-requests/new", () => <CustomerRequestFormView {...forms} basePath="/customer/service-requests" />],
  ["customer-packages", "/customer/service-packages", () => <CustomerPackagesView items={[pkg]} cursor="" nextCursor="next" />],
  ["customer-plans", "/customer/service-plans", () => <CustomerPlansView {...overview} />],
  ["customer-profile", "/customer/profile", () => <CustomerProfileView profile={profile("customer")} customer={customer} />],
  ...["maintenanceSchedule", "renewals", "notifications"].map(view => ["customer-lifecycle-" + view, "/customer/lifecycle", () => <CustomerLifecycleView profile={profile("customer")} view={view} items={view === "renewals" ? renewals : lifecycle} nextCursor="next" cursor="" consent={{ enabled: false, phone: "" }} />]),
  ["customer-empty", "/customer/appliances", () => <CustomerApplianceList customer={customer} items={[]} nextCursor={null} />],
  ["customer-unlinked", "/customer/profile", () => <CustomerProfileView profile={profile("customer")} customer={null} />],
  ["technician-empty", "/technician/assignments", () => <RequestList {...emptyPage} assignedOnly basePath="/technician/assignments" />],
];
window.__uiScreens = screens.map(([name, path]) => ({ name, path }));
const selected = screens.find(([name]) => name === new URLSearchParams(location.search).get("screen")) || screens[0];
window.__uiPath = selected[1];
window.__ready = false;
window.__uiError = null;
class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { window.__uiError = error.stack; window.__ready = true; }
  render() { return this.state.error ? <pre role="alert">{String(this.state.error)}</pre> : this.props.children; }
}
async function boot() {
  const content = await selected[2]();
  const role = selected[1].split("/")[1];
  const wrapped = role === "customer" ? <CustomerHomeFrame><DashboardShell profile={profile(role)}>{content}</DashboardShell></CustomerHomeFrame> : role === "login" ? content : <WorkspaceShell profile={profile(role)}>{content}</WorkspaceShell>;
  createRoot(document.getElementById("root")).render(<Boundary>{wrapped}</Boundary>);
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}
boot().catch(error => { window.__uiError = error.stack; window.__ready = true; });
