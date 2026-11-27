import Link from "next/link";
import { Icon } from "@/components/admin-dashboard/icons";
import type { CustomerRecord } from "@/lib/customers/data";
import type { ApplianceRecord } from "@/lib/appliances/data";
import type { PlanRecord } from "@/lib/service-plans/data";
import type { ServiceRequestRecord } from "@/lib/service-requests/data";
import { serviceTypes, requestStatuses } from "@/lib/service-requests/data";
import {
  ApplianceAvatar,
  ApplianceTypeBadge,
  CoverageBadge,
  RecordStatusBadge,
  displayDate,
} from "./shared";
import s from "./appliances.module.css";

export type AdminApplianceDetailData = {
  customer: CustomerRecord;
  appliance: ApplianceRecord;
  plans: { items: PlanRecord[]; nextCursor: string | null } | null;
  requests: ServiceRequestRecord[];
};

export function AdminApplianceDetails({
  data,
  saved,
  planSaved,
}: {
  data: AdminApplianceDetailData;
  saved?: boolean;
  planSaved?: boolean;
}) {
  const { customer, appliance, plans, requests } = data;
  const currentPlan = plans?.items?.[0] ?? null;
  const baseCustomerAppliance = `/admin/customers/${customer.id}/appliances/${appliance.id}`;

  return (
    <div className={s.screen}>
      {/* Back Links */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Link className={s.backLink} href="/admin/appliances">
          ← All appliances
        </Link>
        <span style={{ color: "#cbd5e1" }}>|</span>
        <Link className={s.backLink} href={`/admin/customers/${customer.id}`}>
          Customer details ({customer.fullName})
        </Link>
      </div>

      {/* Page Heading */}
      <div className={s.pageHeading}>
        <div>
          <span className={s.eyebrow}>APPLIANCE OVERVIEW</span>
          <h1>
            {appliance.brand} {appliance.model}
            <span>.</span>
          </h1>
          <p>
            {appliance.type === "ac" ? "Air Conditioner" : "Water Purifier"} · Serial:{" "}
            {appliance.serialNumber ? (
              <span className={s.monoTag}>{appliance.serialNumber}</span>
            ) : (
              "None"
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            className={s.primary}
            href={`/admin/service-requests/new?customerId=${customer.id}&applianceId=${appliance.id}`}
          >
            <Icon name="request" />
            Request service
          </Link>
          <Link className={s.secondary} href={`${baseCustomerAppliance}/edit`}>
            Edit appliance
          </Link>
        </div>
      </div>

      {/* Feedback alerts if saved */}
      {saved && (
        <div
          style={{
            padding: "12px 18px",
            background: "#ecfdf5",
            border: "1px solid rgba(5,150,105,0.25)",
            borderRadius: 9,
            color: "#059669",
            fontWeight: 600,
            fontSize: 13.5,
          }}
          role="status"
        >
          Appliance information saved successfully.
        </div>
      )}
      {planSaved && (
        <div
          style={{
            padding: "12px 18px",
            background: "#ecfdf5",
            border: "1px solid rgba(5,150,105,0.25)",
            borderRadius: 9,
            color: "#059669",
            fontWeight: 600,
            fontSize: 13.5,
          }}
          role="status"
        >
          Service plan updated. Coverage periods and visit balances have been refreshed.
        </div>
      )}

      {/* Detail Grid */}
      <div className={s.detailGrid}>
        {/* Left Column: Appliance & Customer Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Appliance Specs Panel */}
          <section className={s.panel}>
            <div className={s.panelHeading}>
              <h2>
                <ApplianceAvatar type={appliance.type} />
                Appliance Specifications
              </h2>
              <RecordStatusBadge active={appliance.active} />
            </div>
            <dl className={s.information}>
              <div>
                <dt>Appliance Type</dt>
                <dd>
                  <ApplianceTypeBadge type={appliance.type} />
                </dd>
              </div>
              <div>
                <dt>Brand Name</dt>
                <dd>{appliance.brand}</dd>
              </div>
              <div>
                <dt>Model Number</dt>
                <dd>{appliance.model}</dd>
              </div>
              <div>
                <dt>Serial Number</dt>
                <dd>
                  {appliance.serialNumber ? (
                    <span className={s.monoTag}>{appliance.serialNumber}</span>
                  ) : (
                    "Not recorded"
                  )}
                </dd>
              </div>
              <div>
                <dt>Installation Date</dt>
                <dd>{displayDate(appliance.installationDate)}</dd>
              </div>
              <div>
                <dt>Purchase Date</dt>
                <dd>{displayDate(appliance.purchaseDate)}</dd>
              </div>
              <div>
                <dt>Record Registered</dt>
                <dd>{displayDate(appliance.createdAt)}</dd>
              </div>
              <div>
                <dt>Last Updated</dt>
                <dd>{displayDate(appliance.updatedAt)}</dd>
              </div>
              {appliance.notes && (
                <div className={s.fullWidth}>
                  <dt>Technician / Location Notes</dt>
                  <dd style={{ whiteSpace: "pre-wrap", fontWeight: 500, color: "#475569" }}>
                    {appliance.notes}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Customer Contact Panel */}
          <section className={s.panel}>
            <div className={s.panelHeading}>
              <h2>
                <Icon name="customers" />
                Customer & Location
              </h2>
              <Link className={s.textLink} href={`/admin/customers/${customer.id}`}>
                View customer record →
              </Link>
            </div>
            <dl className={s.information}>
              <div className={s.fullWidth}>
                <dt>Customer Name</dt>
                <dd style={{ fontSize: 16 }}>{customer.fullName}</dd>
              </div>
              <div>
                <dt>Primary Phone</dt>
                <dd>
                  <a href={`tel:${customer.phone}`} style={{ color: "#07529b", textDecoration: "none" }}>
                    {customer.phone || "Not recorded"}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Email Address</dt>
                <dd>
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`} style={{ color: "#07529b", textDecoration: "none" }}>
                      {customer.email}
                    </a>
                  ) : (
                    "Not provided"
                  )}
                </dd>
              </div>
              <div className={s.fullWidth}>
                <dt>Service Address</dt>
                <dd style={{ fontWeight: 500 }}>
                  {[customer.address, customer.city, customer.state, customer.pincode]
                    .filter(Boolean)
                    .join(", ") || "No address on file"}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Right Column: Service Plan & Service History */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Service Plan Card */}
          <section className={s.panel}>
            <div className={s.panelHeading}>
              <h2>
                <Icon name="plan" />
                Active Service Plan
              </h2>
              <Link className={s.secondary} href={`${baseCustomerAppliance}/service-plans`} style={{ minHeight: 34, padding: "6px 12px", fontSize: 12.5 }}>
                Manage plans
              </Link>
            </div>

            {currentPlan ? (
              <div className={s.planCardBody}>
                <div className={s.planCardHeading}>
                  <div>
                    <h3 className={s.planName}>{currentPlan.name}</h3>
                    <p className={s.planDates}>
                      Coverage: {displayDate(currentPlan.startsOn)} – {displayDate(currentPlan.expiresOn)}
                    </p>
                  </div>
                  <CoverageBadge status={currentPlan.status} />
                </div>

                <div>
                  <div className={s.allowanceText}>
                    <span>Included Maintenance Visits</span>
                    <span>
                      {currentPlan.usedServices} of {currentPlan.totalServices} visits used
                    </span>
                  </div>
                  <div className={s.allowanceTrack}>
                    <div
                      className={s.allowanceBar}
                      style={{
                        width: `${
                          currentPlan.totalServices > 0
                            ? Math.min(100, Math.round((currentPlan.usedServices / currentPlan.totalServices) * 100))
                            : 0
                        }%`,
                        backgroundColor: currentPlan.status === "exhausted" ? "#b45309" : "#059669",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    <span>{currentPlan.remainingServices} visits remaining</span>
                    <span>{currentPlan.status === "active" ? "Active period" : "Renewal due"}</span>
                  </div>
                </div>

                {plans && plans.items.length > 1 && (
                  <div style={{ borderTop: "1px solid #edf2f7", paddingTop: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Plan History ({plans.items.length} total)
                    </span>
                    <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
                      {plans.items.slice(1, 4).map(p => (
                        <li key={p.id} style={{ fontSize: 12.5, color: "#475569", display: "flex", justifyContent: "space-between" }}>
                          <span>{p.name} ({displayDate(p.startsOn)} - {displayDate(p.expiresOn)})</span>
                          <span style={{ fontWeight: 600 }}>{p.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "32px 24px", textAlign: "center" }}>
                <p style={{ color: "#64748b", margin: "0 0 14px", fontSize: 13.5 }}>
                  This appliance does not currently have an active service or AMC plan attached.
                </p>
                <Link className={s.secondary} href={`${baseCustomerAppliance}/service-plans`}>
                  + Attach service plan
                </Link>
              </div>
            )}
          </section>

          {/* Service History Panel */}
          <section className={s.panel}>
            <div className={s.panelHeading}>
              <h2>
                <Icon name="clock" />
                Service History
                <span className={s.countPill}>{requests.length}</span>
              </h2>
              <Link
                className={s.textLink}
                href={`/admin/service-requests/new?customerId=${customer.id}&applianceId=${appliance.id}`}
              >
                + Log request
              </Link>
            </div>

            {requests.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center" }}>
                <p style={{ color: "#64748b", margin: 0, fontSize: 13.5 }}>
                  No service requests logged for this appliance yet.
                </p>
              </div>
            ) : (
              <div className={s.historyList}>
                {requests.map(req => {
                  const statusColors: Record<string, { bg: string; text: string }> = {
                    pending: { bg: "#fef3c7", text: "#92400e" },
                    in_progress: { bg: "#e0f2fe", text: "#0369a1" },
                    completed: { bg: "#ecfdf5", text: "#065f46" },
                    cancelled: { bg: "#f1f5f9", text: "#475569" },
                  };
                  const color = statusColors[req.status] || { bg: "#f1f5f9", text: "#475569" };

                  return (
                    <Link
                      key={req.id}
                      className={s.historyRow}
                      href={`/admin/service-requests/${req.id}`}
                    >
                      <div className={s.historyMain}>
                        <span className={s.iconTile} style={{ width: 32, height: 32 }}>
                          <Icon name="request" />
                        </span>
                        <div>
                          <div className={s.historyType}>
                            {serviceTypes[req.serviceType] || req.serviceType}
                          </div>
                          <div className={s.historyDesc}>
                            {req.description.length > 60
                              ? req.description.slice(0, 60) + "…"
                              : req.description}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: color.bg,
                            color: color.text,
                          }}
                        >
                          {requestStatuses[req.status] || req.status}
                        </span>
                        <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                          {displayDate(req.createdAt)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
