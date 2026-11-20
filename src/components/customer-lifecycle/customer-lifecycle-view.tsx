"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/roles";
import type { LifecycleRow, LifecycleView } from "@/lib/lifecycle/server";
import { indiaDate, serviceDueStatus } from "../../../scripts/lifecycle-policy.mjs";
import styles from "./lifecycle.module.css";

interface CustomerLifecycleViewProps {
  profile: Profile;
  view: LifecycleView;
  items: LifecycleRow[];
  nextCursor: string | null;
  cursor: string;
  consent: { phone: string; enabled: boolean };
}

function formatDate(isoOrYmd: string | number | boolean | null | undefined): string {
  if (!isoOrYmd || typeof isoOrYmd !== "string") return "—";
  try {
    const d = isoOrYmd.includes("T") ? new Date(isoOrYmd) : new Date(isoOrYmd + "T00:00:00Z");
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeZone: "Asia/Kolkata",
    }).format(d);
  } catch {
    return String(isoOrYmd);
  }
}

function formatPrice(paise: string | number | boolean | null | undefined): string {
  if (paise === null || paise === undefined) return "—";
  const num = Number(paise);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num / 100);
}

export function CustomerLifecycleView({
  view,
  items,
  nextCursor,
  cursor,
  consent: initialConsent,
}: CustomerLifecycleViewProps) {
  const router = useRouter();
  const today = indiaDate();

  // WhatsApp consent state
  const [waPhone, setWaPhone] = useState(initialConsent.phone);
  const [waEnabled, setWaEnabled] = useState(initialConsent.enabled);
  const [waBusy, setWaBusy] = useState(false);
  const [waMessage, setWaMessage] = useState("");

  // Action states for renewal cards
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, { success?: string; error?: string }>>({});

  async function handleRenewalAction(row: LifecycleRow, action: "agree" | "decline") {
    const rowId = String(row.id);
    setActionBusyId(rowId);
    setActionFeedback(prev => ({ ...prev, [rowId]: {} }));

    try {
      const res = await fetch("/api/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: row.id,
          expectedVersion: row.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save action");

      setActionFeedback(prev => ({
        ...prev,
        [rowId]: {
          success: action === "agree" ? "Agreed! Our admin team will confirm your renewal." : "Renewal proposal declined.",
        },
      }));
      router.refresh();
    } catch (err) {
      setActionFeedback(prev => ({
        ...prev,
        [rowId]: {
          error: err instanceof Error ? err.message : "Unable to process action.",
        },
      }));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleConsentSubmit(e: FormEvent) {
    e.preventDefault();
    setWaBusy(true);
    setWaMessage("");

    try {
      const res = await fetch("/api/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "consent",
          phone: waPhone,
          enabled: waEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save preferences");
      setWaMessage("WhatsApp preferences updated successfully.");
    } catch (err) {
      setWaMessage(err instanceof Error ? err.message : "Could not save preferences.");
    } finally {
      setWaBusy(false);
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTop}>
          <div>
            <span className={styles.kicker}>CARE &amp; RENEWALS</span>
            <h1 className={styles.title}>
              Service Lifecycle<span className={styles.titleDot}>.</span>
            </h1>
            <p className={styles.subtitle}>
              Track scheduled routine maintenance visits, review proactive AMC renewal proposals, and
              manage automated service alerts.
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className={styles.viewTabs} aria-label="Lifecycle sections">
        <Link
          href="/customer/lifecycle?view=maintenanceSchedule"
          className={`${styles.viewTabBtn} ${view === "maintenanceSchedule" ? styles.viewTabActive : ""}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Service Calendar</span>
          {view === "maintenanceSchedule" && items.length > 0 && (
            <span className={styles.tabBadge}>{items.length}</span>
          )}
        </Link>

        <Link
          href="/customer/lifecycle?view=renewals"
          className={`${styles.viewTabBtn} ${view === "renewals" ? styles.viewTabActive : ""}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>Renewals &amp; Offers</span>
          {view === "renewals" && items.length > 0 && (
            <span className={styles.tabBadge}>{items.length}</span>
          )}
        </Link>

        <Link
          href="/customer/lifecycle?view=notifications"
          className={`${styles.viewTabBtn} ${view === "notifications" ? styles.viewTabActive : ""}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span>Alert History</span>
          {view === "notifications" && items.length > 0 && (
            <span className={styles.tabBadge}>{items.length}</span>
          )}
        </Link>
      </nav>

      {/* Reassurance Notice */}
      <div className={styles.infoNotice}>
        <svg className={styles.infoNoticeIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div>
          <strong>Transparent scheduling in Indian Standard Time (IST):</strong>
          <div>
            Due dates indicate target maintenance intervals. Booking a visit connects you with our
            certified technician dispatch team. Maintenance visits are never deducted automatically.
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {items.length === 0 ? (
        <section className={styles.emptyState}>
          <div className={styles.emptyIconCircle}>
            {view === "maintenanceSchedule" ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            ) : view === "renewals" ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            )}
          </div>
          <h2 className={styles.emptyHeading}>
            {view === "maintenanceSchedule"
              ? "No scheduled visits"
              : view === "renewals"
              ? "No pending renewal proposals"
              : "No message history"}
          </h2>
          <p className={styles.emptyDesc}>
            {view === "maintenanceSchedule"
              ? "When you activate an annual service plan (AMC), upcoming preventive visits will appear on your calendar."
              : view === "renewals"
              ? "When your service plan approaches expiration, our care team will post renewal options here for your review."
              : "Notifications and service updates sent via SMS or WhatsApp will be logged here."}
          </p>
          <Link href="/customer/appliances" className={styles.emptyActionBtn}>
            View my appliances →
          </Link>
        </section>
      ) : (
        <div className={styles.recordsGrid}>
          {items.map(item => {
            const rowId = String(item.id);

            // 1. Maintenance Schedule View
            if (view === "maintenanceSchedule") {
              const dueStatus = serviceDueStatus(
                {
                  status: String(item.status ?? ""),
                  dueOn: String(item.dueOn ?? ""),
                  expiresOn: String(item.expiresOn ?? ""),
                },
                today
              );

              const canBookFree =
                !item.requestId &&
                item.status !== "completed" &&
                String(item.startsOn ?? "") <= today &&
                String(item.expiresOn ?? "") >= today;

              let pillClass = styles.pillUpcoming;
              let pillText = "Upcoming";
              if (dueStatus === "due") {
                pillClass = styles.pillDue;
                pillText = "Due Today";
              } else if (dueStatus === "overdue") {
                pillClass = styles.pillOverdue;
                pillText = "Overdue";
              } else if (dueStatus === "completed" || item.status === "completed") {
                pillClass = styles.pillCompleted;
                pillText = "Completed";
              } else if (dueStatus === "expired") {
                pillClass = styles.pillOverdue;
                pillText = "Expired";
              }

              return (
                <article key={rowId} className={styles.recordCard}>
                  <div className={`${styles.cardTopAccent} ${styles.accentEmerald}`} />

                  <div className={styles.cardTop}>
                    <div className={styles.cardHeaderRow}>
                      <span className={styles.applianceTag}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="5" y="2" width="14" height="20" rx="3" />
                          <line x1="5" y1="10" x2="19" y2="10" />
                        </svg>
                        <span>{String(item.applianceLabel || "Home Appliance")}</span>
                      </span>

                      <span className={`${styles.statusPill} ${pillClass}`}>
                        <span>● {pillText}</span>
                      </span>
                    </div>

                    <h3 className={styles.cardTitle}>
                      {String(item.planName || "Annual Maintenance Visit")} • Visit #{String(item.visit || "1")}
                    </h3>

                    <div className={styles.cardMetaGrid}>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Target Due Date</span>
                        <span className={styles.metaValue}>{formatDate(item.dueOn)}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Valid Through</span>
                        <span className={styles.metaValue}>{formatDate(item.expiresOn)}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Service Stage</span>
                        <span className={styles.metaValue} style={{ textTransform: "capitalize" }}>
                          {String(item.workflowStatus || item.status || "Scheduled")}
                        </span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Linked Request</span>
                        <span className={styles.metaValue}>
                          {item.requestId ? `#${String(item.requestId).slice(0, 8)}` : "None yet"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    {canBookFree && item.applianceId && (
                      <Link
                        href={`/customer/service-requests/new?applianceId=${item.applianceId}&serviceType=maintenance&free=1`}
                        className={styles.requestServiceBtn}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>Request Free Maintenance</span>
                      </Link>
                    )}

                    {item.requestId && (
                      <Link
                        href={`/customer/service-requests/${item.requestId}`}
                        className={styles.trackServiceBtn}
                      >
                        <span>Track Live Service Visit →</span>
                      </Link>
                    )}

                    {item.applianceId && (
                      <Link
                        href={`/customer/appliances/${item.applianceId}`}
                        className={styles.applianceHistoryLink}
                      >
                        <span>View appliance and plan history →</span>
                      </Link>
                    )}
                  </div>
                </article>
              );
            }

            // 2. Renewals View
            if (view === "renewals") {
              const statusStr = String(item.status || "");
              const isAwaiting = statusStr === "awaiting_customer";
              const isAgreed = statusStr === "agreed";
              const isConfirmed = statusStr === "confirmed";
              const feedback = actionFeedback[rowId];
              const isBusy = actionBusyId === rowId;
              const formattedPrice = formatPrice(item.pricePaise);

              return (
                <article key={rowId} className={styles.recordCard}>
                  <div className={`${styles.cardTopAccent} ${styles.accentNavy}`} />

                  <div className={styles.cardTop}>
                    <div className={styles.cardHeaderRow}>
                      <span className={styles.applianceTag}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>{String(item.applianceLabel || "Covered Appliance")}</span>
                      </span>

                      <span
                        className={`${styles.statusPill} ${
                          isAwaiting
                            ? styles.pillDue
                            : isAgreed
                            ? styles.pillUpcoming
                            : isConfirmed
                            ? styles.pillCompleted
                            : styles.pillOverdue
                        }`}
                      >
                        <span>
                          ●{" "}
                          {isAwaiting
                            ? "Action Needed"
                            : isAgreed
                            ? "Agreed"
                            : isConfirmed
                            ? "Active"
                            : statusStr}
                        </span>
                      </span>
                    </div>

                    <h3 className={styles.cardTitle}>
                      {String(item.planName || "Annual Plan Renewal")}
                    </h3>

                    <div className={styles.cardMetaGrid}>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Renewal Price</span>
                        <span className={styles.metaValue} style={{ color: "var(--life-navy)" }}>
                          {formattedPrice}
                        </span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Valid From</span>
                        <span className={styles.metaValue}>{formatDate(item.startsOn)}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Valid Through</span>
                        <span className={styles.metaValue}>{formatDate(item.expiresOn)}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Offer Status</span>
                        <span className={styles.metaValue} style={{ textTransform: "capitalize" }}>
                          {statusStr.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    {isAwaiting && (
                      <div>
                        <div className={styles.renewalActionRow}>
                          <button
                            type="button"
                            className={styles.agreeBtn}
                            onClick={() => handleRenewalAction(item, "agree")}
                            disabled={isBusy}
                          >
                            <span>{isBusy ? "Saving…" : `Agree to renewal — ${formattedPrice}`}</span>
                          </button>
                          <button
                            type="button"
                            className={styles.declineBtn}
                            onClick={() => handleRenewalAction(item, "decline")}
                            disabled={isBusy}
                          >
                            <span>Decline</span>
                          </button>
                        </div>
                        {feedback?.success && (
                          <p role="status" className={`${styles.actionFeedback} ${styles.feedbackSuccess}`}>
                            {feedback.success}
                          </p>
                        )}
                        {feedback?.error && (
                          <p role="alert" className={`${styles.actionFeedback} ${styles.feedbackError}`}>
                            {feedback.error}
                          </p>
                        )}
                      </div>
                    )}

                    {isAgreed && (
                      <p style={{ margin: "4px 0", fontSize: "12.5px", color: "var(--life-emerald-dark)", fontWeight: 600 }}>
                        ✓ Renewal agreement submitted. Admin confirmation in progress.
                      </p>
                    )}

                    {item.applianceId && (
                      <Link
                        href={`/customer/appliances/${item.applianceId}`}
                        className={styles.applianceHistoryLink}
                      >
                        <span>View appliance and plan history →</span>
                      </Link>
                    )}
                  </div>
                </article>
              );
            }

            // 3. Notifications View
            return (
              <article key={rowId} className={styles.recordCard}>
                <div className={`${styles.cardTopAccent} ${styles.accentAmber}`} />

                <div className={styles.cardTop}>
                  <div className={styles.cardHeaderRow}>
                    <span className={styles.applianceTag}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      <span>Alert</span>
                    </span>

                    <span className={`${styles.statusPill} ${styles.pillCompleted}`}>
                      <span>● Sent</span>
                    </span>
                  </div>

                  <h3 className={styles.cardTitle}>
                    {String(item.kind || "Service Notification").replace(/_/g, " ")}
                  </h3>

                  <div className={styles.cardMetaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Sent On</span>
                      <span className={styles.metaValue}>{formatDate(item.createdAt)}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Destination Phone</span>
                      <span className={styles.metaValue}>{String(item.phone || "Registered Mobile")}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Delivery Provider</span>
                      <span className={styles.metaValue}>{String(item.providerId || "Direct Gateway")}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Attempts</span>
                      <span className={styles.metaValue}>{String(item.attempts || "1")}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {(cursor || nextCursor) && (
        <div className={styles.paginationRow}>
          <span className={styles.paginationNote}>Up to 50 records per page</span>
          <div style={{ display: "flex", gap: "10px" }}>
            {cursor && (
              <Link href={`/customer/lifecycle?view=${view}`} className={styles.pageBtn}>
                ← First page
              </Link>
            )}
            {nextCursor && (
              <Link
                href={`/customer/lifecycle?view=${view}&cursor=${encodeURIComponent(nextCursor)}`}
                className={styles.pageBtn}
              >
                Next page →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Preferences Form */}
      <section className={styles.consentCard}>
        <div className={styles.consentHeader}>
          <div className={styles.consentIconWrap}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div>
            <h3 className={styles.consentTitle}>WhatsApp Service Notification Preferences</h3>
            <p className={styles.consentDesc}>
              Receive timely maintenance due reminders, technician assignment alerts, and renewal
              proposals directly on your WhatsApp. You can modify or withdraw consent anytime.
            </p>
          </div>
        </div>

        <form className={styles.consentForm} onSubmit={handleConsentSubmit}>
          <div className={styles.consentField}>
            <label htmlFor="wa-phone">Registered WhatsApp Number</label>
            <input
              id="wa-phone"
              className={styles.consentInput}
              value={waPhone}
              disabled={waBusy}
              onChange={e => setWaPhone(e.target.value)}
              placeholder="+91 98765 43210"
              maxLength={16}
            />
          </div>

          <label className={styles.consentCheckboxWrap}>
            <input
              type="checkbox"
              checked={waEnabled}
              disabled={waBusy}
              onChange={e => setWaEnabled(e.target.checked)}
            />
            <span>I agree to receive service and renewal WhatsApp notifications from iTech.</span>
          </label>

          <button type="submit" className={styles.saveConsentBtn} disabled={waBusy}>
            {waBusy ? "Saving…" : "Save WhatsApp Preference"}
          </button>

          {waMessage && (
            <p
              role="status"
              style={{
                margin: "4px 0 0",
                fontSize: "12.5px",
                fontWeight: 600,
                color: waMessage.includes("success") ? "#15803d" : "var(--life-red)",
              }}
            >
              {waMessage}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
