"use client";

import { useState } from "react";
import Link from "next/link";
import type { ApplianceRecord } from "@/lib/appliances/data";
import { applianceTypes } from "@/lib/appliances/data";
import type { PlanRecord } from "@/lib/service-plans/data";
import { HomeIcon } from "@/components/customer-home/icons";
import styles from "./appliances.module.css";

export type ApplianceWithPlans = {
  appliance: ApplianceRecord;
  current: PlanRecord | null;
  upcoming: PlanRecord | null;
};

type Props = {
  customer: { active: boolean } | null;
  items: ApplianceWithPlans[];
  nextCursor: string | null;
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

export function CustomerApplianceList({
  customer,
  items,
  nextCursor,
  cursor = "",
  basePath = "/customer/appliances",
}: Props) {
  const [filter, setFilter] = useState<"all" | "water_purifier" | "ac">("all");

  if (!customer) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle}>
            <HomeIcon name="profile" />
          </div>
          <h2>Your profile is not linked yet</h2>
          <p>
            Ask your administrator to connect your customer profile before viewing your appliances and service plans.
          </p>
          <Link className={styles.emptyAction} href="/customer/profile">
            View profile
          </Link>
        </div>
      </div>
    );
  }

  const wpCount = items.filter(i => i.appliance.type === "water_purifier").length;
  const acCount = items.filter(i => i.appliance.type === "ac").length;

  const filteredItems = items.filter(item => {
    if (filter === "all") return true;
    return item.appliance.type === filter;
  });

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <span className={styles.kicker}>YOUR HOME</span>
        <div className={styles.titleRow}>
          <h1>My Appliances</h1>
          <span className={styles.countBadge}>
            {items.length} {items.length === 1 ? "Appliance" : "Appliances"}
          </span>
        </div>
        <p className={styles.subtitle}>Manage your registered home appliances and service coverage.</p>
      </header>

      {items.length > 0 && (wpCount > 0 || acCount > 0) && (
        <div className={styles.filterRow} role="tablist" aria-label="Filter appliances by category">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={styles.filterChip}
            data-active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All ({items.length})
          </button>
          {wpCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={filter === "water_purifier"}
              className={styles.filterChip}
              data-active={filter === "water_purifier"}
              onClick={() => setFilter("water_purifier")}
            >
              Water Purifiers ({wpCount})
            </button>
          )}
          {acCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={filter === "ac"}
              className={styles.filterChip}
              data-active={filter === "ac"}
              onClick={() => setFilter("ac")}
            >
              Air Conditioners ({acCount})
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle}>
            <HomeIcon name="appliance" />
          </div>
          <h2>No appliances registered yet</h2>
          <p>
            Your air conditioners and water purifiers will appear here once registered by the iTech service team.
            Contact support to link your devices and activate service care plans.
          </p>
          <Link className={styles.emptyAction} href="/customer/service-requests/new">
            Request an installation
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle}>
            <HomeIcon name="appliance" />
          </div>
          <h2>No appliances in this category</h2>
          <p>You do not have any registered appliances matching the selected filter.</p>
          <button
            type="button"
            className={styles.emptyAction}
            onClick={() => setFilter("all")}
          >
            Show all appliances
          </button>
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {filteredItems.map(({ appliance, current, upcoming }) => {
            const hasActivePlan = current?.status === "active";
            const isWaterPurifier = appliance.type === "water_purifier";

            return (
              <article key={appliance.id} className={styles.applianceCard}>
                <div className={styles.cardTop}>
                  <div className={styles.iconBox} data-type={appliance.type}>
                    <HomeIcon name={isWaterPurifier ? "water" : "ac"} />
                  </div>
                  <div className={styles.badges}>
                    <span
                      className={styles.statusPill}
                      data-tone={appliance.active ? "positive" : "neutral"}
                    >
                      <span className={styles.statusDot} />
                      {appliance.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className={styles.typeLabel}>{applianceTypes[appliance.type] || appliance.type}</div>
                <h2 className={styles.cardTitle}>
                  {appliance.brand} {appliance.model}
                </h2>

                <div className={styles.metaRow}>
                  {appliance.serialNumber ? (
                    <span className={styles.serialChip}>SN: {appliance.serialNumber}</span>
                  ) : (
                    <span>Serial: Not provided</span>
                  )}
                  <span className={styles.installDate}>
                    • Installed: {formatDate(appliance.installationDate)}
                  </span>
                </div>

                <div className={styles.planBox}>
                  {current ? (
                    <>
                      <div className={styles.planHeader}>
                        <span className={styles.planName}>{current.name}</span>
                        <span
                          className={styles.statusPill}
                          data-tone={
                            current.status === "active"
                              ? "positive"
                              : current.status === "expired"
                              ? "warning"
                              : "neutral"
                          }
                        >
                          {current.status === "active"
                            ? "Active plan"
                            : current.status === "expired"
                            ? "Plan expired"
                            : "Plan exhausted"}
                        </span>
                      </div>
                      <div className={styles.planValidity}>
                        {hasActivePlan ? (
                          <>Valid through: {formatDate(current.expiresOn)}</>
                        ) : (
                          <>Expired: {formatDate(current.expiresOn)}</>
                        )}
                      </div>
                      {hasActivePlan && (
                        <div className={styles.visitsBadge}>
                          <HomeIcon name="shield" />
                          <span>
                            {current.remainingServices}{" "}
                            {current.remainingServices === 1 ? "visit" : "visits"} remaining
                          </span>
                        </div>
                      )}
                    </>
                  ) : upcoming ? (
                    <>
                      <div className={styles.planHeader}>
                        <span className={styles.planName}>{upcoming.name}</span>
                        <span className={styles.statusPill} data-tone="neutral">
                          Upcoming renewal
                        </span>
                      </div>
                      <div className={styles.planValidity}>
                        Starts on: {formatDate(upcoming.startsOn)}
                      </div>
                    </>
                  ) : (
                    <div className={styles.noPlanNote}>No active service plan attached</div>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <Link
                    href={`${basePath}/${appliance.id}`}
                    className={styles.viewDetailsBtn}
                    aria-label={`View details for ${appliance.brand} ${appliance.model}`}
                  >
                    <span>View details</span>
                    <HomeIcon name="arrow" />
                  </Link>
                  {appliance.active && (
                    <Link
                      href={`/customer/service-requests/new?applianceId=${appliance.id}`}
                      className={styles.quickServiceBtn}
                      aria-label={`Request service for ${appliance.brand} ${appliance.model}`}
                    >
                      Request service
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

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
