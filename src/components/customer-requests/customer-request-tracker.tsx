"use client";

import Link from "next/link";
import {
  serviceTypes,
  requestStatuses,
  type ServiceRequestRecord,
  type RequestStatus,
} from "@/lib/service-requests/data";
import { HomeIcon } from "@/components/customer-home/icons";
import styles from "./requests.module.css";

type Props = {
  item: ServiceRequestRecord;
  saved?: boolean;
};

function formatDateTime(val: string | undefined): string {
  if (!val) return "Not recorded";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    }).format(new Date(val));
  } catch {
    return val;
  }
}

export function CustomerRequestTracker({ item, saved = false }: Props) {
  const isCancelled = item.status === "cancelled";
  const isCompleted = item.status === "completed";
  const isInProgress = item.status === "in_progress";
  const isPending = item.status === "pending";
  const hasTechnician = Boolean(item.assignedTechnicianName);

  // Stepper calculations (0 to 100%)
  // Step 1: Placed (always done)
  // Step 2: Assigned
  // Step 3: In Progress
  // Step 4: Completed
  let progressPercent = 0;
  if (isCompleted) {
    progressPercent = 100;
  } else if (isInProgress) {
    progressPercent = 66;
  } else if (hasTechnician) {
    progressPercent = 33;
  } else {
    progressPercent = 0;
  }

  const getStepStatus = (stepIndex: number): "completed" | "current" | "upcoming" => {
    if (isCompleted) return "completed";
    if (stepIndex === 1) return "completed";
    if (stepIndex === 2) {
      if (isInProgress) return "completed";
      if (hasTechnician) return "current";
      return isPending ? "current" : "upcoming";
    }
    if (stepIndex === 3) {
      if (isInProgress) return "current";
      return "upcoming";
    }
    if (stepIndex === 4) {
      return isCompleted ? "completed" : "upcoming";
    }
    return "upcoming";
  };

  return (
    <div className={styles.container}>
      {/* Back Link */}
      <Link href="/customer/service-requests" className={styles.backLink}>
        <HomeIcon name="arrow" style={{ transform: "rotate(180deg)" }} />
        <span>Back to service requests</span>
      </Link>

      {/* Success Notification */}
      {saved && (
        <div className={styles.successBanner} role="status">
          <HomeIcon name="check" />
          <span>Your service request was submitted successfully! Our care team is reviewing it.</span>
        </div>
      )}

      {/* Hero Tracker Card */}
      <section className={styles.trackerHeroCard}>
        <div className={styles.heroHeaderRow}>
          <div>
            <span className={styles.kicker}>REQUEST DETAILS &amp; TRACKING</span>
            <h1 className={styles.heroTitle}>
              {serviceTypes[item.serviceType] || item.serviceType} Request
            </h1>
            <p className={styles.heroAppliance}>{item.applianceLabel}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <span className={styles.statusPill} data-tone={item.status}>
              <span className={styles.statusDot} />
              {requestStatuses[item.status as RequestStatus] || item.status}
            </span>
            <span className={styles.referenceId}>ID: {item.id}</span>
          </div>
        </div>

        {/* Stepper Progress (or Cancellation Notice) */}
        {!isCancelled ? (
          <div className={styles.stepperContainer} aria-label="Service progress tracker">
            <div className={styles.stepperTrack}>
              <div
                className={styles.stepperProgressLine}
                style={{ width: `calc(${progressPercent}% * 0.92)` }}
              />

              {/* Step 1: Request Placed */}
              <div className={styles.stepItem} data-status={getStepStatus(1)}>
                <div className={styles.stepIconCircle}>
                  <HomeIcon name="check" />
                </div>
                <span className={styles.stepLabel}>Request Placed</span>
                <span className={styles.stepSubtext}>{formatDateTime(item.createdAt)}</span>
              </div>

              {/* Step 2: Assigned */}
              <div className={styles.stepItem} data-status={getStepStatus(2)}>
                <div className={styles.stepIconCircle}>
                  {getStepStatus(2) === "completed" ? (
                    <HomeIcon name="check" />
                  ) : (
                    <HomeIcon name="profile" />
                  )}
                </div>
                <span className={styles.stepLabel}>
                  {hasTechnician ? "Technician Assigned" : "Assigning Technician"}
                </span>
                <span className={styles.stepSubtext}>
                  {hasTechnician ? item.assignedTechnicianName : "In queue"}
                </span>
              </div>

              {/* Step 3: In Progress */}
              <div className={styles.stepItem} data-status={getStepStatus(3)}>
                <div className={styles.stepIconCircle}>
                  {getStepStatus(3) === "completed" ? (
                    <HomeIcon name="check" />
                  ) : (
                    <HomeIcon name="wrench" />
                  )}
                </div>
                <span className={styles.stepLabel}>In Progress</span>
                <span className={styles.stepSubtext}>
                  {isInProgress ? "Work ongoing" : "Inspection pending"}
                </span>
              </div>

              {/* Step 4: Completed */}
              <div className={styles.stepItem} data-status={getStepStatus(4)}>
                <div className={styles.stepIconCircle}>
                  <HomeIcon name="check" />
                </div>
                <span className={styles.stepLabel}>Completed</span>
                <span className={styles.stepSubtext}>
                  {isCompleted ? formatDateTime(item.updatedAt) : "Final sign-off"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.cancelAlert} role="alert">
            <HomeIcon name="clock" />
            <div>
              <h4>Service request cancelled</h4>
              <p>
                This request was cancelled on {formatDateTime(item.updatedAt)}. No maintenance visits were
                deducted from your plan allowance.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Detail Cards Grid */}
      <div className={styles.detailsGrid}>
        {/* Card 1: Technician Assignment */}
        <section className={styles.detailCard}>
          <h2 className={styles.detailCardTitle}>
            <HomeIcon name="profile" />
            <span>Assigned Professional</span>
          </h2>

          {item.assignedTechnicianName ? (
            <div className={styles.technicianBox}>
              <div className={styles.techAvatar}>
                <HomeIcon name="profile" />
              </div>
              <div className={styles.techMeta}>
                <strong className={styles.techName}>{item.assignedTechnicianName}</strong>
                <span className={styles.techRole}>Certified iTech Service Technician</span>
                <span style={{ fontSize: "11px", color: "var(--req-muted)", marginTop: "4px" }}>
                  Assigned on: {formatDateTime(item.assignmentUpdatedAt || item.updatedAt)}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.unassignedNote}>
              <p style={{ margin: "0 0 6px", fontWeight: "650", color: "var(--req-ink)" }}>
                Technician assignment in progress
              </p>
              <span>
                Our operations team is scheduling a verified technician for your location. You will receive an update once assigned.
              </span>
            </div>
          )}
        </section>

        {/* Card 2: Appliance Context */}
        <section className={styles.detailCard}>
          <h2 className={styles.detailCardTitle}>
            <HomeIcon name="appliance" />
            <span>Appliance &amp; Description</span>
          </h2>

          <div className={styles.infoField}>
            <span className={styles.infoLabel}>Appliance</span>
            <p className={styles.infoValue}>
              <strong>{item.applianceLabel}</strong>
            </p>
          </div>

          <div className={styles.infoField}>
            <span className={styles.infoLabel}>Customer Description</span>
            <p className={styles.infoValue}>{item.description}</p>
          </div>

          <div style={{ marginTop: "14px" }}>
            <Link
              href={`/customer/appliances/${item.applianceId}`}
              className={styles.trackLink}
              style={{ fontSize: "12px", marginLeft: 0 }}
            >
              <span>View appliance specs &amp; plan history</span>
              <HomeIcon name="arrow" />
            </Link>
          </div>
        </section>

        {/* Card 3: Included Maintenance Plan & Visit Allowance */}
        {item.servicePlanId || item.serviceType === "maintenance" ? (
          <section className={styles.detailCard} style={{ gridColumn: "1 / -1" }}>
            <h2 className={styles.detailCardTitle}>
              <HomeIcon name="shield" />
              <span>Service Plan Coverage</span>
            </h2>

            <div className={styles.planBenefitBox}>
              <HomeIcon name="shield" />
              <div>
                <strong>{item.servicePlanName || "Included Maintenance Coverage"}</strong>
                <p style={{ margin: "4px 0 0" }}>
                  {item.servicePlanCreditUsed
                    ? "1 included maintenance visit was deducted from your plan allowance upon completion."
                    : item.servicePlanOutcome === "pending"
                    ? "This visit is linked to your active plan. 1 visit will be deducted only after successful completion within your plan validity period."
                    : item.servicePlanOutcome === "expired"
                    ? "Your service plan expired before service completion; no included visit was deducted."
                    : item.servicePlanOutcome === "exhausted"
                    ? "All included visits on your plan were already utilized; no visit was deducted."
                    : "Included visits cover routine maintenance. Installation, repairs and complaints do not deduct from your allowance."}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {/* Tracker Bottom Actions */}
      <div className={styles.trackerActions}>
        <Link href="/customer/service-requests" className={styles.primaryBtn}>
          <span>View all service requests</span>
        </Link>
        <Link href={`/customer/appliances/${item.applianceId}`} className={styles.outlineBtn}>
          <span>View appliance</span>
        </Link>
      </div>
    </div>
  );
}
