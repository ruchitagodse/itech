"use client";

import { useState } from "react";
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
  items: ServiceRequestRecord[];
  basePath?: string;
  cursor?: string;
  nextCursor?: string | null;
  status?: string;
};

function formatDate(val: string): string {
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

export function CustomerRequestsView({
  items,
  basePath = "/customer/service-requests",
  cursor = "",
  nextCursor = null,
  status = "",
}: Props) {
  const [filter, setFilter] = useState<string>(status || "all");

  const pendingCount = items.filter(i => i.status === "pending").length;
  const inProgressCount = items.filter(i => i.status === "in_progress").length;
  const completedCount = items.filter(i => i.status === "completed").length;
  const cancelledCount = items.filter(i => i.status === "cancelled").length;

  const filteredItems = items.filter(item => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTop}>
          <div>
            <span className={styles.kicker}>SERVICE CARE</span>
            <div className={styles.titleRow}>
              <h1>My Service Requests</h1>
              <span className={styles.countBadge}>
                {items.length} {items.length === 1 ? "Request" : "Requests"}
              </span>
            </div>
            <p className={styles.subtitle}>
              Track your maintenance visits, repair complaints and home appliance installations in real time.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/customer/appliances" className={styles.primaryBtn}>
              <HomeIcon name="wrench" />
              <span>Request service</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Filter Chips */}
      {items.length > 0 && (
        <div className={styles.filterRow} role="tablist" aria-label="Filter requests by status">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={styles.filterChip}
            data-active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All Requests ({items.length})
          </button>
          {inProgressCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={filter === "in_progress"}
              className={styles.filterChip}
              data-active={filter === "in_progress"}
              onClick={() => setFilter("in_progress")}
            >
              In Progress ({inProgressCount})
            </button>
          )}
          {pendingCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={filter === "pending"}
              className={styles.filterChip}
              data-active={filter === "pending"}
              onClick={() => setFilter("pending")}
            >
              Pending ({pendingCount})
            </button>
          )}
          {completedCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={filter === "completed"}
              className={styles.filterChip}
              data-active={filter === "completed"}
              onClick={() => setFilter("completed")}
            >
              Completed ({completedCount})
            </button>
          )}
          {cancelledCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={filter === "cancelled"}
              className={styles.filterChip}
              data-active={filter === "cancelled"}
              onClick={() => setFilter("cancelled")}
            >
              Cancelled ({cancelledCount})
            </button>
          )}
        </div>
      )}

      {/* Requests List */}
      {items.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle}>
            <HomeIcon name="wrench" />
          </div>
          <h2>No service requests yet</h2>
          <p>
            When you request maintenance, report an issue, or schedule an installation, your service progress will appear here.
          </p>
          <Link href="/customer/appliances" className={styles.emptyAction}>
            View my appliances
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle}>
            <HomeIcon name="clock" />
          </div>
          <h2>No requests in this view</h2>
          <p>No service requests match the selected status filter.</p>
          <button
            type="button"
            className={styles.emptyAction}
            onClick={() => setFilter("all")}
          >
            Show all requests
          </button>
        </div>
      ) : (
        <div className={styles.requestsGrid}>
          {filteredItems.map(item => {
            const isWaterPurifier =
              item.applianceLabel.toLowerCase().includes("purifier") ||
              item.applianceLabel.toLowerCase().includes("ro") ||
              item.applianceLabel.toLowerCase().includes("water");

            return (
              <article key={item.id} className={styles.requestCard}>
                <div className={styles.cardTopRow}>
                  <div className={styles.serviceInfo}>
                    <div className={styles.serviceIconBox} data-type={item.serviceType}>
                      <HomeIcon name={isWaterPurifier ? "water" : "ac"} />
                    </div>
                    <div className={styles.serviceLabels}>
                      <span className={styles.serviceType}>
                        {serviceTypes[item.serviceType] || item.serviceType}
                      </span>
                      <strong className={styles.applianceName}>{item.applianceLabel}</strong>
                    </div>
                  </div>

                  <span className={styles.statusPill} data-tone={item.status}>
                    <span className={styles.statusDot} />
                    {requestStatuses[item.status as RequestStatus] || item.status}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <p className={styles.descriptionSnippet}>{item.description}</p>

                  <div className={styles.metaRow}>
                    <div className={styles.metaItem}>
                      <HomeIcon name="calendar" />
                      <span>Requested on {formatDate(item.createdAt)}</span>
                    </div>

                    <div className={styles.metaItem}>
                      <HomeIcon name="profile" />
                      {item.assignedTechnicianName ? (
                        <span className={styles.technicianHighlight}>
                          Technician: {item.assignedTechnicianName}
                        </span>
                      ) : (
                        <span>Assigning technician</span>
                      )}
                    </div>

                    {item.servicePlanName && (
                      <span className={styles.planTag}>
                        <HomeIcon name="shield" />
                        <span>{item.servicePlanName}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.referenceId}>Ref: {item.id.slice(0, 8)}</span>
                  <Link
                    href={`${basePath}/${item.id}`}
                    className={styles.trackLink}
                    aria-label={`Track service request for ${item.applianceLabel}`}
                  >
                    <span>Track request</span>
                    <HomeIcon name="arrow" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {(cursor || nextCursor) && (
        <div className={styles.paginationRow}>
          <span className={styles.paginationNote}>Up to 25 requests per page</span>
          <div className={styles.paginationButtons}>
            {cursor && (
              <Link
                href={basePath + (status ? `?status=${encodeURIComponent(status)}` : "")}
                className={styles.pageBtn}
              >
                First page
              </Link>
            )}
            {nextCursor && (
              <Link
                href={`${basePath}?${status ? `status=${encodeURIComponent(status)}&` : ""}cursor=${encodeURIComponent(nextCursor)}`}
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
