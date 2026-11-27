import Link from "next/link";
import type { ApplianceRecord } from "@/lib/appliances/data";
import { applianceTypes } from "@/lib/appliances/data";
import type { PlanRecord } from "@/lib/service-plans/data";
import type { ServiceRequestRecord } from "@/lib/service-requests/data";
import { requestStatuses, serviceTypes } from "@/lib/service-requests/data";
import { HomeIcon } from "@/components/customer-home/icons";
import styles from "./appliances.module.css";

type Props = {
  appliance: ApplianceRecord;
  currentPlan: PlanRecord | null;
  upcomingPlan: PlanRecord | null;
  planHistory: PlanRecord[];
  requests: ServiceRequestRecord[];
  planCursor?: string;
  nextPlanCursor?: string | null;
};

function formatDate(val: string | undefined): string {
  if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(val + "T12:00:00Z"));
}

function formatDateTime(val: string | undefined): string {
  if (!val) return "Not recorded";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(val));
  } catch {
    return val;
  }
}

export function CustomerApplianceDetailsView({
  appliance,
  currentPlan,
  upcomingPlan,
  planHistory,
  requests,
  planCursor = "",
  nextPlanCursor = null,
}: Props) {
  const isWaterPurifier = appliance.type === "water_purifier";
  const hasActivePlan = currentPlan?.status === "active";
  const usedPercent = currentPlan
    ? Math.min(100, Math.round((currentPlan.usedServices / (currentPlan.totalServices || 1)) * 100))
    : 0;

  return (
    <div className={styles.container}>
      <Link href="/customer/appliances" className={styles.backLink}>
        <HomeIcon name="arrow" style={{ transform: "rotate(180deg)" }} />
        <span>Back to My Appliances</span>
      </Link>

      {/* Appliance Hero */}
      <section className={styles.detailsHero}>
        <div className={styles.detailsHeroTop}>
          <div className={styles.heroMain}>
            <div className={styles.heroIconBox} data-type={appliance.type}>
              <HomeIcon name={isWaterPurifier ? "water" : "ac"} />
            </div>
            <div className={styles.heroText}>
              <span className={styles.kicker}>
                {applianceTypes[appliance.type] || appliance.type}
              </span>
              <h1>
                {appliance.brand} {appliance.model}
              </h1>
              <div className={styles.heroBadges}>
                <span
                  className={styles.statusPill}
                  data-tone={appliance.active ? "positive" : "neutral"}
                >
                  <span className={styles.statusDot} />
                  {appliance.active ? "Active" : "Inactive"}
                </span>
                {appliance.serialNumber && (
                  <span className={styles.serialChip}>SN: {appliance.serialNumber}</span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.heroActions}>
            {appliance.active && (
              <>
                <Link
                  href={`/customer/service-requests/new?applianceId=${appliance.id}`}
                  className={styles.primaryActionBtn}
                >
                  <HomeIcon name="plus" />
                  <span>Request service</span>
                </Link>
                <Link
                  href={`/customer/service-requests/new?applianceId=${appliance.id}&serviceType=repair`}
                  className={styles.secondaryActionBtn}
                >
                  Report a complaint
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2-Column Content Layout */}
      <div className={styles.detailsContentLayout}>
        {/* Left Column: Specifications, Installation, and Service Coverage */}
        <div className={styles.detailsLeftColumn}>
          {/* Appliance Overview & Specs */}
          <section className={styles.detailSection}>
            <div className={styles.sectionHeader}>
              <h2>Appliance overview</h2>
            </div>
            <div className={styles.specsGrid}>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Category</span>
                <span className={styles.specValue}>{applianceTypes[appliance.type]}</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Brand</span>
                <span className={styles.specValue}>{appliance.brand}</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Model</span>
                <span className={styles.specValue}>{appliance.model}</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Serial number</span>
                <span className={styles.specValue}>
                  {appliance.serialNumber || "Not recorded"}
                </span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Purchase date</span>
                <span className={styles.specValue}>{formatDate(appliance.purchaseDate)}</span>
              </div>
              <div className={styles.specItem}>
                <span className={styles.specLabel}>Registered date</span>
                <span className={styles.specValue}>{formatDateTime(appliance.createdAt)}</span>
              </div>
              {appliance.notes && (
                <div className={styles.specItem} style={{ gridColumn: "1 / -1" }}>
                  <span className={styles.specLabel}>Notes</span>
                  <span className={styles.specValue}>{appliance.notes}</span>
                </div>
              )}
            </div>
          </section>

          {/* Installation Details */}
          <section className={styles.detailSection}>
            <div className={styles.sectionHeader}>
              <h2>Installation information</h2>
            </div>
            <div className={styles.installationCard}>
              <div className={styles.installInfo}>
                <h3>Installation record</h3>
                <p>
                  Installed on: <strong>{formatDate(appliance.installationDate)}</strong>
                </p>
              </div>
              <span className={styles.statusPill} data-tone="positive">
                <span className={styles.statusDot} />
                Installed
              </span>
            </div>
          </section>

          {/* Service Plan Coverage */}
          <section className={styles.detailSection}>
            <div className={styles.sectionHeader}>
              <h2>Service plan coverage</h2>
            </div>

            {currentPlan ? (
              <div className={styles.planCard}>
                <div className={styles.planCardHeading}>
                  <div>
                    <h3>{currentPlan.name}</h3>
                    <p>
                      Valid: {formatDate(currentPlan.startsOn)} — {formatDate(currentPlan.expiresOn)}{" "}
                      (IST, inclusive)
                    </p>
                  </div>
                  <span
                    className={styles.statusPill}
                    data-tone={
                      currentPlan.status === "active"
                        ? "positive"
                        : currentPlan.status === "expired"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {currentPlan.status === "active"
                      ? "Active plan"
                      : currentPlan.status === "expired"
                      ? "Expired"
                      : "All visits used"}
                  </span>
                </div>

                {/* Progress bar */}
                <div className={styles.allowanceMeter}>
                  <div className={styles.allowanceLabels}>
                    <span>
                      {currentPlan.usedServices} of {currentPlan.totalServices} visits used
                    </span>
                    <span className={styles.remainingText}>
                      {currentPlan.remainingServices}{" "}
                      {currentPlan.remainingServices === 1 ? "visit" : "visits"} remaining
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${usedPercent}%` }} />
                  </div>
                </div>

                <p className={styles.planNote}>
                  Included visits cover routine maintenance. Installation, repairs and complaints are
                  separate.
                </p>

                <div className={styles.planActionRow}>
                  {appliance.active &&
                    hasActivePlan &&
                    currentPlan.remainingServices > 0 && (
                      <Link
                        href={`/customer/service-requests/new?applianceId=${appliance.id}&serviceType=maintenance&free=1`}
                        className={styles.freeServiceBtn}
                      >
                        <HomeIcon name="shield" />
                        <span>Book free maintenance</span>
                      </Link>
                    )}
                </div>
              </div>
            ) : upcomingPlan ? (
              <div className={styles.planCard}>
                <div className={styles.planCardHeading}>
                  <div>
                    <h3>{upcomingPlan.name}</h3>
                    <p>Starts on: {formatDate(upcomingPlan.startsOn)}</p>
                  </div>
                  <span className={styles.statusPill} data-tone="neutral">
                    Upcoming renewal
                  </span>
                </div>
                <p className={styles.planNote}>
                  Visits become available when this service plan period starts.
                </p>
              </div>
            ) : (
              <div className={styles.emptyCard} style={{ margin: 0, padding: "24px 16px" }}>
                <p style={{ margin: 0 }}>
                  No active service plan attached to this appliance. Contact your service
                  provider or administrator to explore AMC packages.
                </p>
              </div>
            )}

            {/* Upcoming renewal if both current and upcoming exist */}
            {currentPlan && upcomingPlan && (
              <div className={styles.planCard} style={{ marginTop: "14px" }}>
                <div className={styles.planCardHeading}>
                  <div>
                    <h3>Upcoming renewal: {upcomingPlan.name}</h3>
                    <p>Starts: {formatDate(upcomingPlan.startsOn)}</p>
                  </div>
                  <span className={styles.statusPill} data-tone="neutral">
                    Scheduled
                  </span>
                </div>
              </div>
            )}

            {/* Past periods */}
            {planHistory.length > 0 && (
              <details className={styles.historyDetails}>
                <summary className={styles.historySummary}>
                  View plan history ({planHistory.length} previous{" "}
                  {planHistory.length === 1 ? "period" : "periods"})
                </summary>
                <div className={styles.historyList}>
                  {planHistory.map(period => (
                    <div key={period.id} className={styles.specItem}>
                      <span className={styles.specLabel}>{period.name}</span>
                      <span className={styles.specValue}>
                        {formatDate(period.startsOn)} — {formatDate(period.expiresOn)} (
                        {period.usedServices} of {period.totalServices} visits used)
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {(planCursor || nextPlanCursor) && (
              <div className={styles.paginationRow} style={{ marginTop: "16px", padding: 0 }}>
                <span className={styles.paginationNote}>Plan history pagination</span>
                <div className={styles.paginationButtons}>
                  {planCursor && (
                    <Link href={`/customer/appliances/${appliance.id}`} className={styles.pageBtn}>
                      Latest periods
                    </Link>
                  )}
                  {nextPlanCursor && (
                    <Link
                      href={`/customer/appliances/${appliance.id}?planCursor=${encodeURIComponent(
                        nextPlanCursor
                      )}`}
                      className={styles.pageBtn}
                    >
                      Older periods →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Service History */}
        <div className={styles.detailsRightColumn}>
          <section className={styles.detailSection}>
            <div className={styles.sectionHeader}>
              <h2>Service history</h2>
              <span className={styles.countBadge}>
                {requests.length} {requests.length === 1 ? "Record" : "Records"}
              </span>
            </div>

            {requests.length === 0 ? (
              <div className={styles.emptyCard} style={{ margin: 0, padding: "32px 16px" }}>
                <p style={{ margin: 0 }}>No service requests recorded for this appliance yet.</p>
              </div>
            ) : (
              <div className={styles.requestsList}>
                {requests.map(req => {
                  const isCompleted = req.status === "completed";
                  const isPending = req.status === "pending";
                  const isInProgress = req.status === "in_progress";

                  return (
                    <article key={req.id} className={styles.requestItem}>
                      <div className={styles.requestItemTop}>
                        <span className={styles.serviceTypeTag}>
                          {serviceTypes[req.serviceType] || req.serviceType}
                        </span>
                        <span
                          className={styles.statusPill}
                          data-tone={
                            isCompleted ? "positive" : isPending || isInProgress ? "warning" : "neutral"
                          }
                        >
                          <span className={styles.statusDot} />
                          {requestStatuses[req.status] || req.status}
                        </span>
                      </div>

                      <p className={styles.requestDesc}>{req.description}</p>

                      <div className={styles.requestMeta}>
                        <span>{formatDateTime(req.createdAt)}</span>
                        {req.assignedTechnicianName && (
                          <span>Tech: {req.assignedTechnicianName}</span>
                        )}
                        <Link
                          href={`/customer/service-requests/${req.id}`}
                          className={styles.requestLink}
                        >
                          <span>Track</span>
                          <HomeIcon name="arrow" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Bottom CTA Banner */}
      <section className={styles.bottomActionBanner}>
        <div className={styles.bannerContent}>
          <h3>Need care for your {appliance.brand} {appliance.model}?</h3>
          <p>Book regular maintenance, request an inspection, or lodge a repair complaint.</p>
        </div>
        <div className={styles.bannerActions}>
          <Link
            href={`/customer/service-requests/new?applianceId=${appliance.id}`}
            className={styles.bannerPrimaryBtn}
          >
            <HomeIcon name="plus" />
            <span>Request a service</span>
          </Link>
          <Link
            href={`/customer/service-requests/new?applianceId=${appliance.id}&serviceType=repair`}
            className={styles.bannerSecondaryBtn}
          >
            Report a complaint
          </Link>
        </div>
      </section>
    </div>
  );
}
