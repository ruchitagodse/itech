"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { applianceTypes, type ApplianceType } from "@/lib/appliances/data";
import { serviceTypes, type ServiceType } from "@/lib/service-requests/data";
import { packagePrice, type ServicePackageRecord } from "@/lib/service-packages/data";
import styles from "./packages.module.css";

interface CustomerPackagesViewProps {
  items: ServicePackageRecord[];
  cursor: string;
  nextCursor: string | null;
  basePath?: string;
}

type ApplianceFilter = "all" | ApplianceType;
type ServiceFilter = "all" | ServiceType;

function parseInclusions(description: string): string[] {
  if (!description) return [];
  const lines = description
    .split(/\r?\n|•|\*/g)
    .map(s => s.trim())
    .filter(s => s.length > 2);
  if (lines.length > 1) {
    return lines.slice(0, 4);
  }
  // Try splitting by sentence if only one long line
  const sentences = description
    .split(/\.\s+/)
    .map(s => s.trim().replace(/\.$/, ""))
    .filter(s => s.length > 5);
  if (sentences.length > 1) {
    return sentences.slice(0, 3);
  }
  return [description];
}

export function CustomerPackagesView({
  items,
  cursor,
  nextCursor,
  basePath = "/customer/service-packages",
}: CustomerPackagesViewProps) {
  const [selectedAppliance, setSelectedAppliance] = useState<ApplianceFilter>("all");
  const [selectedService, setSelectedService] = useState<ServiceFilter>("all");

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedAppliance !== "all" && item.applianceType !== selectedAppliance) {
        return false;
      }
      if (selectedService !== "all" && item.serviceType !== selectedService) {
        return false;
      }
      return true;
    });
  }, [items, selectedAppliance, selectedService]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      water_purifier: items.filter(i => i.applianceType === "water_purifier").length,
      ac: items.filter(i => i.applianceType === "ac").length,
      maintenance: items.filter(i => i.serviceType === "maintenance").length,
      repair: items.filter(i => i.serviceType === "repair").length,
      installation: items.filter(i => i.serviceType === "installation").length,
    };
  }, [items]);

  function getButtonLabel(serviceType: ServiceType): string {
    switch (serviceType) {
      case "maintenance":
        return "Book Maintenance →";
      case "repair":
        return "Book Diagnostic Visit →";
      case "installation":
        return "Schedule Installation →";
      default:
        return "Book Service →";
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTop}>
          <div>
            <span className={styles.kicker}>SERVICE CATALOGUE</span>
            <h1 className={styles.title}>
              Care &amp; Service Packages<span className={styles.titleDot}>.</span>
            </h1>
            <p className={styles.subtitle}>
              Transparent, fixed-price appliance installation, preventive maintenance, and repair
              packages performed by background-verified professionals.
            </p>
          </div>

          <div className={styles.packageCountBadge}>
            <span className={styles.countDot} />
            <span>
              {filteredItems.length} {filteredItems.length === 1 ? "Package" : "Packages"} Available
            </span>
          </div>
        </div>
      </header>

      {/* Trust & Guarantee Banner */}
      <div className={styles.trustBanner}>
        <div className={styles.trustItem}>
          <div className={styles.trustIconWrap}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h4 className={styles.trustTitle}>30-Day Service Guarantee</h4>
            <p className={styles.trustSubtitle}>Free revisit if any issue recurs within 30 days</p>
          </div>
        </div>

        <div className={styles.trustItem}>
          <div className={styles.trustIconWrap}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div>
            <h4 className={styles.trustTitle}>100% Genuine Spare Parts</h4>
            <p className={styles.trustSubtitle}>Direct manufacturer filters &amp; OEM consumables</p>
          </div>
        </div>

        <div className={styles.trustItem}>
          <div className={styles.trustIconWrap}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </svg>
          </div>
          <div>
            <h4 className={styles.trustTitle}>Certified Technicians</h4>
            <p className={styles.trustSubtitle}>Trained and background-verified technicians</p>
          </div>
        </div>
      </div>

      {/* Filter Chips Section */}
      <section className={styles.filterSection} aria-label="Package category filters">
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filter by Appliance:</span>
          <div className={styles.filterChips}>
            <button
              type="button"
              className={`${styles.filterChip} ${selectedAppliance === "all" ? styles.filterChipActive : ""}`}
              onClick={() => setSelectedAppliance("all")}
              aria-pressed={selectedAppliance === "all"}
            >
              <span>All Appliances</span>
              <span className={styles.chipCount}>{counts.all}</span>
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${selectedAppliance === "water_purifier" ? styles.filterChipActive : ""}`}
              onClick={() => setSelectedAppliance("water_purifier")}
              aria-pressed={selectedAppliance === "water_purifier"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2C10 6 5 11 5 15a7 7 0 0 0 14 0c0-4-5-9-7-13Z" />
              </svg>
              <span>Water Purifiers</span>
              <span className={styles.chipCount}>{counts.water_purifier}</span>
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${selectedAppliance === "ac" ? styles.filterChipActive : ""}`}
              onClick={() => setSelectedAppliance("ac")}
              aria-pressed={selectedAppliance === "ac"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="10" rx="3" />
                <path d="M5 10h14M7 18v3m5-4v5m5-4v3" />
              </svg>
              <span>Air Conditioners</span>
              <span className={styles.chipCount}>{counts.ac}</span>
            </button>
          </div>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filter by Service Type:</span>
          <div className={styles.filterChips}>
            <button
              type="button"
              className={`${styles.filterChip} ${selectedService === "all" ? styles.filterChipActive : ""}`}
              onClick={() => setSelectedService("all")}
              aria-pressed={selectedService === "all"}
            >
              <span>All Services</span>
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${selectedService === "maintenance" ? styles.filterChipActive : ""}`}
              onClick={() => setSelectedService("maintenance")}
              aria-pressed={selectedService === "maintenance"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Maintenance (AMC)</span>
              <span className={styles.chipCount}>{counts.maintenance}</span>
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${selectedService === "repair" ? styles.filterChipActive : ""}`}
              onClick={() => setSelectedService("repair")}
              aria-pressed={selectedService === "repair"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span>Repairs &amp; Diagnosis</span>
              <span className={styles.chipCount}>{counts.repair}</span>
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${selectedService === "installation" ? styles.filterChipActive : ""}`}
              onClick={() => setSelectedService("installation")}
              aria-pressed={selectedService === "installation"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Installation</span>
              <span className={styles.chipCount}>{counts.installation}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Packages Grid or Empty State */}
      {filteredItems.length === 0 ? (
        <section className={styles.emptyState}>
          <div className={styles.emptyIconCircle}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h2 className={styles.emptyHeading}>No packages match your selection</h2>
          <p className={styles.emptyDesc}>
            Try clearing your filters to explore our full range of water purifier and air conditioner
            care offerings.
          </p>
          <button
            type="button"
            className={styles.clearFilterBtn}
            onClick={() => {
              setSelectedAppliance("all");
              setSelectedService("all");
            }}
          >
            Clear all filters
          </button>
        </section>
      ) : (
        <div className={styles.packagesGrid}>
          {filteredItems.map(item => {
            const formattedPrice = packagePrice(item.pricePaise);
            const inclusions = parseInclusions(item.description);
            const isMaintenance = item.serviceType === "maintenance";
            const visitsCount = item.policy?.maintenanceIntervalMonths
              ? Math.floor(item.policy.validityMonths / item.policy.maintenanceIntervalMonths)
              : null;

            return (
              <article key={item.id} className={styles.packageCard}>
                <div className={styles.featuredAccent} />

                <div className={styles.cardTop}>
                  <div className={styles.cardBadgesRow}>
                    <span className={styles.appliancePill}>
                      {item.applianceType === "water_purifier" ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 2C10 6 5 11 5 15a7 7 0 0 0 14 0c0-4-5-9-7-13Z" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="2" y="4" width="20" height="10" rx="3" />
                          <path d="M5 10h14" />
                        </svg>
                      )}
                      <span>{applianceTypes[item.applianceType]}</span>
                    </span>

                    <span
                      className={`${styles.serviceTypePill} ${
                        isMaintenance ? styles.maintenancePill : ""
                      }`}
                    >
                      {serviceTypes[item.serviceType]}
                    </span>
                  </div>

                  <h3 className={styles.packageName}>{item.name}</h3>

                  <div className={styles.priceSection}>
                    <div className={styles.priceWrap}>
                      <span className={styles.priceAmount}>{formattedPrice}</span>
                      <span className={styles.priceTag}>all-inclusive</span>
                    </div>
                    <span className={styles.priceGuarantee}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Fixed Price</span>
                    </span>
                  </div>

                  {item.policy && (
                    <div className={styles.policyBanner}>
                      <svg
                        className={styles.policyIcon}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <div className={styles.policyText}>
                        <strong>{item.policy.validityMonths} Months Coverage</strong>
                        <span>
                          {visitsCount ? `${visitsCount} maintenance visits included` : "Routine checkups included"}{" "}
                          (every {item.policy.maintenanceIntervalMonths} mos)
                        </span>
                      </div>
                    </div>
                  )}

                  <div className={styles.descriptionWrap}>
                    <span className={styles.descriptionTitle}>What&apos;s Included:</span>
                    <ul className={styles.inclusionsList}>
                      {inclusions.map((inclusion, idx) => (
                        <li key={idx} className={styles.inclusionItem}>
                          <svg
                            className={styles.checkIcon}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{inclusion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={styles.cardAction}>
                  <Link
                    href={`/customer/service-requests/new?serviceType=${item.serviceType}`}
                    className={styles.bookButton}
                  >
                    <span>{getButtonLabel(item.serviceType)}</span>
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
          <span className={styles.paginationNote}>Up to 25 packages per page</span>
          <div className={styles.paginationButtons}>
            {cursor && (
              <Link href={basePath} className={styles.pageBtn}>
                ← First page
              </Link>
            )}
            {nextCursor && (
              <Link
                href={`${basePath}?cursor=${encodeURIComponent(nextCursor)}`}
                className={styles.pageBtn}
              >
                Next page →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Commercial & Multi-unit Consultation Card */}
      <section className={styles.customConsultCard}>
        <div className={styles.consultLeft}>
          <div className={styles.consultIconWrap}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 21h18" />
              <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
              <path d="M9 9h1" />
              <path d="M9 13h1" />
              <path d="M9 17h1" />
              <path d="M14 9h1" />
              <path d="M14 13h1" />
              <path d="M14 17h1" />
            </svg>
          </div>
          <div>
            <h3 className={styles.consultHeading}>Need a Custom AMC or Multi-Unit Quote?</h3>
            <p className={styles.consultText}>
              We provide tailored enterprise maintenance contracts for residential societies,
              offices, and multi-appliance homes with dedicated technician dispatch.
            </p>
          </div>
        </div>

        <div className={styles.consultActions}>
          <a href="tel:+919876543210" className={styles.consultCallBtn}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>+91 98765 43210</span>
          </a>
          <a href="mailto:care@itech.in" className={styles.consultCallBtn}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span>care@itech.in</span>
          </a>
        </div>
      </section>
    </div>
  );
}
