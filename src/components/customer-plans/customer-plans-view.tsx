"use client";

import { useState } from "react";
import Link from "next/link";
import type { ApplianceRecord } from "@/lib/appliances/data";
import { applianceTypes } from "@/lib/appliances/data";
import type { PlanRecord } from "@/lib/service-plans/data";
import { indiaDate } from "@/lib/service-plans/data";
import type { LifecycleRow } from "@/lib/lifecycle/server";
import { HomeIcon } from "@/components/customer-home/icons";
import styles from "./plans.module.css";

export type AppliancePlanItem = {
  appliance: ApplianceRecord;
  current: PlanRecord | null;
  upcoming: PlanRecord | null;
};

type Props = {
  customer: { active: boolean } | null;
  items: AppliancePlanItem[];
  renewals?: LifecycleRow[];
  nextCursor?: string | null;
  cursor?: string;
  basePath?: string;
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

function isExpiringSoon(expiresOn: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return false;
  const cutoff = new Date(today + "T12:00:00Z");
  cutoff.setUTCDate(cutoff.getUTCDate() + 30);
  const expiryDate = new Date(expiresOn + "T12:00:00Z");
  const todayDate = new Date(today + "T12:00:00Z");
  return expiryDate >= todayDate && expiryDate <= cutoff;
}

export function CustomerPlansView({
  customer,
  items,
  renewals = [],
  nextCursor = null,
  cursor = "",
  basePath = "/customer/service-plans",
}: Props) {
  const [filter, setFilter] = useState<"all" | "active" | "expiring">("all");
  const today = indiaDate();

  if (!customer) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle}>
            <HomeIcon name="profile" />
          </div>
          <h2>Your profile is not linked yet</h2>
          <p>
            Contact your administrator to link your customer record and view your included service plans.
          </p>
          <Link className={styles.emptyAction} href="/customer/profile">
            View profile
          </Link>
        </div>
      </div>
    );
  }

  const activePlansCount = items.filter(i => i.current?.status === "active").length;
  const expiringOrExpiredCount = items.filter(i => {
    if (!i.current) return false;
    return i.current.status === "expired" || isExpiringSoon(i.current.expiresOn, today);
  }).length;

  const filteredItems = items.filter(item => {
    if (filter === "all") return true;
    if (filter === "active") return item.current?.status === "active";
    if (filter === "expiring") {
      if (!item.current) return false;
      return item.current.status === "expired" || isExpiringSoon(item.current.expiresOn, today);
    }
    return true;
  });

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTop}>
          <div>
            <span className={styles.kicker}>YOUR INCLUDED CARE</span>
            <div className={styles.titleRow}>
              <h1>My Service Plans</h1>
              <span className={styles.countBadge}>
                {activePlansCount} Active {activePlansCount === 1 ? "Plan" : "Plans"}
              </span>
            </div>
            <p className={styles.subtitle}>
              Your appliance coverage, remaining maintenance visits and validity. Complaints are separate
              from included maintenance.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/customer/service-packages" className={styles.catalogueBtn}>
              <HomeIcon name="shield" />
              <span>Service catalogue</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Filter Chips */}
      {items.length > 0 && (
        <div className={styles.filterRow} role="tablist" aria-label="Filter service plans">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={styles.filterChip}
            data-active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All Appliances ({items.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "active"}
            className={styles.filterChip}
            data-active={filter === "active"}
            onClick={() => setFilter("active")}
          >
            Active Plans ({activePlansCount})
          </button>
          {expiringOrExpiredCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={filter === "expiring"}
              className={styles.filterChip}
              data-active={filter === "expiring"}
              onClick={() => setFilter("expiring")}
            >
              Expiring / Expired ({expiringOrExpiredCount})
            </button>
          )}
        </div>
      )}

      {/* Cards Grid or Empty States */}
      {items.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle}>
            <HomeIcon name="appliance" />
          </div>
          <h2>No appliances added yet</h2>
          <p>
            Your administrator can add your home appliances and attach their included service care plans.
          </p>
          <Link className={styles.emptyAction} href="/customer/service-requests/new">
            Request an installation
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle}>
            <HomeIcon name="shield" />
          </div>
          <h2>No plans in this view</h2>
          <p>No service plans match the selected filter category.</p>
          <button
            type="button"
            className={styles.emptyAction}
            onClick={() => setFilter("all")}
          >
            Show all plans
          </button>
        </div>
      ) : (
        <div className={styles.plansGrid}>
          {filteredItems.map(({ appliance, current, upcoming }) => {
            const plan = current ?? upcoming;
            const canRequest = customer.active && appliance.active;
            const canBook = canRequest && current?.status === "active" && current.remainingServices > 0;
            const isWaterPurifier = appliance.type === "water_purifier";

            const expiringSoon = current ? isExpiringSoon(current.expiresOn, today) : false;
            const isExpired = current?.status === "expired";
            const isExhausted = current?.status === "exhausted";

            // Find matching renewal proposal if available
            const renewal = renewals.find(
              r =>
                r.applianceId === appliance.id &&
                (r.status === "awaiting_customer" || r.status === "agreed")
            );

            // Calculation for progress bar
            const total = plan ? plan.totalServices : 0;
            const used = plan ? plan.usedServices : 0;
            const remaining = plan
              ? plan.status === "upcoming"
                ? plan.totalServices - plan.usedServices
                : plan.remainingServices
              : 0;
            const usedPercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

            return (
              <article key={appliance.id} className={styles.planCard}>
                {/* Header: Appliance info + Plan Status */}
                <div className={styles.cardHeader}>
                  <div className={styles.applianceInfo}>
                    <div className={styles.applianceIconBox} data-type={appliance.type}>
                      <HomeIcon name={isWaterPurifier ? "water" : "ac"} />
                    </div>
                    <div className={styles.applianceLabels}>
                      <span className={styles.applianceType}>
                        {applianceTypes[appliance.type] || appliance.type}
                      </span>
                      <strong className={styles.applianceName}>
                        {appliance.brand} {appliance.model}
                      </strong>
                    </div>
                  </div>

                  {plan ? (
                    <span
                      className={styles.statusPill}
                      data-tone={
                        expiringSoon
                          ? "warning"
                          : isExpired
                          ? "critical"
                          : current?.status === "active"
                          ? "positive"
                          : "neutral"
                      }
                    >
                      <span className={styles.statusDot} />
                      {expiringSoon
                        ? "Expiring Soon"
                        : current?.status === "active"
                        ? "Active"
                        : isExpired
                        ? "Expired"
                        : isExhausted
                        ? "All visits used"
                        : "Upcoming"}
                    </span>
                  ) : (
                    <span className={styles.statusPill} data-tone="neutral">
                      No plan
                    </span>
                  )}
                </div>

                {/* Plan Title & Validity */}
                {plan ? (
                  <div className={styles.planNameRow}>
                    <h2 className={styles.planTitle}>{plan.name}</h2>
                    <div className={styles.validityText}>
                      <HomeIcon name="calendar" />
                      <span>
                        Valid through: <strong>{formatDate(plan.expiresOn)}</strong> (IST, inclusive)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.planNameRow}>
                    <h2 className={styles.planTitle}>No active service plan</h2>
                    <p className={styles.subtitle} style={{ fontSize: "13px", marginTop: "2px" }}>
                      This appliance does not currently have an active maintenance coverage package.
                    </p>
                  </div>
                )}

                {/* Maintenance Visit Progress (Core Focus) */}
                {plan && (
                  <section
                    className={styles.progressSection}
                    aria-label={`Maintenance visit progress for ${appliance.brand} ${appliance.model}`}
                  >
                    <div className={styles.progressHeader}>
                      <span className={styles.progressTitle}>Maintenance visit allowance</span>
                      <span
                        className={styles.remainingBadge}
                        data-exhausted={remaining === 0}
                      >
                        <HomeIcon name="shield" />
                        <span>
                          {remaining} {remaining === 1 ? "visit" : "visits"} remaining
                        </span>
                      </span>
                    </div>

                    <div className={styles.progressBarContainer}>
                      <div
                        className={styles.progressFill}
                        data-warning={expiringSoon && remaining > 0}
                        data-exhausted={remaining === 0}
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>

                    <div className={styles.statsRow}>
                      <span>
                        Used: <strong>{used} visits</strong>
                      </span>
                      <span>
                        Total included: <strong>{total} visits</strong>
                      </span>
                    </div>

                    <p className={styles.serviceDeductionNote}>
                      Included visits cover routine maintenance. Installation, repairs and complaints are
                      separate and do not deduct from your allowance.
                    </p>
                  </section>
                )}

                {/* Renewal Experience: Proposal Alert or Scheduled Period */}
                {renewal && renewal.status === "awaiting_customer" ? (
                  <div className={styles.renewalNoticeBox} data-tone="warning">
                    <HomeIcon name="clock" />
                    <div className={styles.renewalNoticeContent}>
                      <h3 className={styles.renewalNoticeTitle}>Renewal proposal ready for review</h3>
                      <p className={styles.renewalNoticeDesc}>
                        A renewal proposal for {String(renewal.planName || "Annual Maintenance Plan")} is
                        ready (₹{Number(renewal.pricePaise) / 100}). Your agreement comes before Admin
                        confirmation.
                      </p>
                      <Link href="/customer/lifecycle?view=renewals" className={styles.renewalActionLink}>
                        <span>Review renewal proposal</span>
                        <HomeIcon name="arrow" />
                      </Link>
                    </div>
                  </div>
                ) : renewal && renewal.status === "agreed" ? (
                  <div className={styles.renewalNoticeBox} data-tone="info">
                    <HomeIcon name="check" />
                    <div className={styles.renewalNoticeContent}>
                      <h3 className={styles.renewalNoticeTitle}>Renewal agreement received</h3>
                      <p className={styles.renewalNoticeDesc} style={{ margin: 0 }}>
                        Your agreement has been submitted. Admin confirmation is the next step to activate
                        your new coverage period.
                      </p>
                    </div>
                  </div>
                ) : current && upcoming ? (
                  <div className={styles.renewalNoticeBox} data-tone="info">
                    <HomeIcon name="calendar" />
                    <div className={styles.renewalNoticeContent}>
                      <h3 className={styles.renewalNoticeTitle}>Upcoming renewal scheduled</h3>
                      <p className={styles.renewalNoticeDesc} style={{ margin: 0 }}>
                        Renewal period scheduled from {formatDate(upcoming.startsOn)} through{" "}
                        {formatDate(upcoming.expiresOn)}, with {upcoming.totalServices} new visits.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Card Actions */}
                <div className={styles.cardActions}>
                  {canBook && (
                    <Link
                      href={`/customer/service-requests/new?applianceId=${appliance.id}&serviceType=maintenance&free=1`}
                      className={styles.freeMaintenanceBtn}
                    >
                      <HomeIcon name="shield" />
                      <span>Book free maintenance</span>
                    </Link>
                  )}

                  <div className={styles.secondaryActionsRow}>
                    {canRequest ? (
                      <Link
                        href={`/customer/service-requests/new?applianceId=${appliance.id}&serviceType=repair`}
                        className={styles.complaintBtn}
                      >
                        Report a complaint
                      </Link>
                    ) : (
                      <span className={styles.subtitle} style={{ fontSize: "12px" }}>
                        This appliance is inactive.
                      </span>
                    )}

                    <Link
                      href={`/customer/appliances/${appliance.id}`}
                      className={styles.historyLink}
                      aria-label={`View details and plan history for ${appliance.brand} ${appliance.model}`}
                    >
                      <span>Details &amp; plan history</span>
                      <HomeIcon name="arrow" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Information Banner */}
      <section className={styles.infoBanner}>
        <div className={styles.infoBannerText}>
          <h3>Need care for another home appliance?</h3>
          <p>
            Explore our comprehensive annual maintenance contracts and service packages in the catalogue.
          </p>
        </div>
        <Link href="/customer/service-packages" className={styles.catalogueBtn}>
          <span>View service catalogue</span>
          <HomeIcon name="arrow" />
        </Link>
      </section>

      {/* Pagination */}
      {(cursor || nextCursor) && (
        <div className={styles.paginationRow}>
          <span className={styles.paginationNote}>Up to 25 appliances per page</span>
          <div className={styles.paginationButtons}>
            {cursor && (
              <Link href={basePath} className={styles.pageBtn}>
                First page
              </Link>
            )}
            {nextCursor && (
              <Link
                href={`${basePath}?cursor=${encodeURIComponent(nextCursor)}`}
                className={styles.pageBtn}
              >
                <span>Next page</span>
                <HomeIcon name="arrow" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
