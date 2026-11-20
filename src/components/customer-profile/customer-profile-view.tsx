import Link from "next/link";
import type { Profile } from "@/lib/roles";
import type { CustomerRecord } from "@/lib/customers/data";
import { ProfileLogoutButton } from "./profile-logout-button";
import styles from "./profile.module.css";

interface CustomerProfileViewProps {
  profile: Profile;
  customer: CustomerRecord | null;
}

function getInitials(name: string): string {
  if (!name || !name.trim()) return "CU";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatPhone(phone: string): string {
  if (!phone) return "Not provided";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone;
}

function formatDate(isoString: string): string {
  if (!isoString) return "Not available";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeZone: "Asia/Kolkata",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function CustomerProfileView({ profile, customer }: CustomerProfileViewProps) {
  if (!customer) {
    return (
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <span className={styles.kicker}>YOUR ACCOUNT</span>
          <h1 className={styles.title}>
            My Profile<span className={styles.titleDot}>.</span>
          </h1>
          <p className={styles.subtitle}>
            Your personal customer account details and service preferences.
          </p>
        </header>

        <section className={styles.unlinkedState}>
          <div className={styles.unlinkedIconCircle}>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className={styles.unlinkedTitle}>Your profile is not linked yet</h2>
          <p className={styles.unlinkedDesc}>
            Your account is signed in as <strong>{profile.email}</strong>, but an administrator
            has not yet linked a customer service record to this email address.
          </p>

          <div className={styles.unlinkedSteps}>
            <div className={styles.unlinkedStep}>
              <span className={styles.stepNumber}>1</span>
              <div>
                <strong>Contact your service administrator</strong>
                <div>Call our care team or provide your registered appliance installation receipt.</div>
              </div>
            </div>
            <div className={styles.unlinkedStep}>
              <span className={styles.stepNumber}>2</span>
              <div>
                <strong>Share your sign-in email</strong>
                <div>Provide <strong>{profile.email}</strong> to the administrator to connect your records.</div>
              </div>
            </div>
            <div className={styles.unlinkedStep}>
              <span className={styles.stepNumber}>3</span>
              <div>
                <strong>Instant access to your appliances & plans</strong>
                <div>Once linked, all your service plans and warranty visits will appear here.</div>
              </div>
            </div>
          </div>

          <div className={styles.unlinkedActions}>
            <a href="tel:+919876543210" className={styles.contactAdminBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>Call Support: +91 98765 43210</span>
            </a>
            <ProfileLogoutButton />
          </div>
        </section>
      </div>
    );
  }

  const initials = getInitials(customer.fullName);
  const formattedPhone = formatPhone(customer.phone);
  const formattedAltPhone = customer.alternatePhone ? formatPhone(customer.alternatePhone) : null;
  const createdDate = formatDate(customer.createdAt);
  const displayId = customer.id.slice(0, 8).toUpperCase();

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <span className={styles.kicker}>YOUR ACCOUNT</span>
        <h1 className={styles.title}>
          My Profile<span className={styles.titleDot}>.</span>
        </h1>
        <p className={styles.subtitle}>
          Manage your verified contact details, service address, and home appliance care preferences.
        </p>
      </header>

      <div className={styles.profileGrid}>
        {/* Left Column: Profile Card + Support */}
        <div className={styles.leftColumn}>
          <div className={styles.profileHeroCard}>
            <div className={styles.heroAccentLine} />
            <div className={styles.avatarWrap}>
              <div className={styles.avatarCircle} aria-hidden="true">
                {initials}
              </div>
            </div>

            <div className={styles.verifiedBadge}>
              <span className={styles.verifiedDot} />
              <span>Verified Customer</span>
            </div>

            <h2 className={styles.customerName}>{customer.fullName}</h2>
            <p className={styles.customerEmail}>{customer.email}</p>

            <div className={styles.idBadge}>
              <span>ID: #{displayId}</span>
            </div>

            <div className={styles.heroDivider} />

            <div className={styles.memberMetaList}>
              <div className={styles.memberMetaItem}>
                <span className={styles.memberMetaLabel}>Account Status</span>
                <span className={styles.memberMetaValue} style={{ color: "var(--prof-emerald)" }}>
                  ● {customer.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className={styles.memberMetaItem}>
                <span className={styles.memberMetaLabel}>Customer Since</span>
                <span className={styles.memberMetaValue}>{createdDate}</span>
              </div>
              <div className={styles.memberMetaItem}>
                <span className={styles.memberMetaLabel}>Sign-in Email</span>
                <span className={styles.memberMetaValue}>{profile.email}</span>
              </div>
            </div>
          </div>

          {/* Quick Support Card */}
          <div className={styles.supportCard}>
            <h3 className={styles.supportCardTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
              <span>Customer Care</span>
            </h3>
            <p className={styles.supportCardText}>
              Need to request address changes or have urgent service inquiries? Our dedicated care team is ready to assist.
            </p>
            <div className={styles.supportLinks}>
              <a href="tel:+919876543210" className={styles.supportLinkBtn}>
                <div className={styles.supportLinkInner}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>+91 98765 43210</span>
                </div>
                <span>Call →</span>
              </a>
              <a href="mailto:care@itech.in" className={styles.supportLinkBtn}>
                <div className={styles.supportLinkInner}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span>care@itech.in</span>
                </div>
                <span>Email →</span>
              </a>
            </div>
            <div className={styles.supportHours}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Mon – Sat: 9:00 AM – 8:00 PM IST</span>
            </div>
          </div>
        </div>

        {/* Right Column: Contact Details, Service Address, Connected Services, Security */}
        <div className={styles.rightColumn}>
          {/* Contact Details Card */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleWrap}>
                <div className={styles.sectionIconWrap}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div>
                  <h3 className={styles.sectionTitle}>Contact Details</h3>
                  <p className={styles.sectionSubtitle}>
                    Verified communication channels for technician visits and notifications
                  </p>
                </div>
              </div>
              <span className={styles.readOnlyTag}>Verified</span>
            </div>

            <div className={styles.detailsGrid}>
              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>Primary Phone</span>
                </span>
                <span className={styles.fieldValue}>{formattedPhone}</span>
                <span className={styles.fieldHint}>Used for appointment confirmation calls</span>
              </div>

              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  <span>Alternate Phone</span>
                </span>
                {formattedAltPhone ? (
                  <span className={styles.fieldValue}>{formattedAltPhone}</span>
                ) : (
                  <span className={styles.fieldValueMuted}>Not provided</span>
                )}
                <span className={styles.fieldHint}>Secondary contact if primary is unreachable</span>
              </div>

              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span>Email Address</span>
                </span>
                <span className={styles.fieldValue}>{customer.email}</span>
                <span className={styles.fieldHint}>Official invoices and service reports</span>
              </div>

              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>Service Alerts</span>
                </span>
                <span className={styles.fieldValue}>SMS & WhatsApp Active</span>
                <span className={styles.fieldHint}>Real-time technician arrival updates</span>
              </div>
            </div>
          </section>

          {/* Registered Service Address Card */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleWrap}>
                <div className={styles.sectionIconWrap} style={{ background: "var(--prof-emerald-soft)", color: "var(--prof-emerald)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <h3 className={styles.sectionTitle}>Registered Service Address</h3>
                  <p className={styles.sectionSubtitle}>
                    All home appliance installations, scheduled maintenance, and repairs occur here
                  </p>
                </div>
              </div>
              <span className={styles.readOnlyTag}>Default Location</span>
            </div>

            <div className={styles.detailsGrid}>
              <div className={`${styles.detailField} ${styles.detailFieldFull}`}>
                <span className={styles.fieldLabel}>Street Address</span>
                <span className={styles.fieldValue}>{customer.address}</span>
              </div>

              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>City & State</span>
                <span className={styles.fieldValue}>
                  {customer.city}, {customer.state}
                </span>
              </div>

              <div className={styles.detailField}>
                <span className={styles.fieldLabel}>Pincode</span>
                <span className={styles.fieldValue}>{customer.pincode}</span>
                <span className={styles.fieldHint}>Active iTech urban service zone</span>
              </div>
            </div>

            <div className={styles.noticeCallout}>
              <svg className={styles.noticeIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div>
                <strong>Need to modify your registered address or phone number?</strong>
                <div>
                  To maintain continuous warranty coverage and AMC record integrity, address updates are verified
                  by our support team. Call <strong>+91 98765 43210</strong> or email <strong>care@itech.in</strong> to request an update.
                </div>
              </div>
            </div>
          </section>

          {/* Quick Hub Navigation Cards */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleWrap}>
                <div className={styles.sectionIconWrap} style={{ background: "var(--prof-amber-soft)", color: "var(--prof-amber)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div>
                  <h3 className={styles.sectionTitle}>Connected Services</h3>
                  <p className={styles.sectionSubtitle}>
                    Quick access to your registered appliances, coverage plans, and service logs
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.quickHubGrid}>
              <Link href="/customer/appliances" className={styles.hubCard}>
                <div className={styles.hubCardTop}>
                  <div className={`${styles.hubCardIcon} ${styles.hubIconBlue}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="2" width="14" height="20" rx="3" />
                      <line x1="5" y1="10" x2="19" y2="10" />
                      <circle cx="9" cy="6" r="1" />
                    </svg>
                  </div>
                  <div>
                    <h4 className={styles.hubCardHeading}>My Appliances</h4>
                    <p className={styles.hubCardDesc}>
                      View installed ACs and water purifiers, serial numbers, and maintenance schedules.
                    </p>
                  </div>
                </div>
                <div className={styles.hubCardFooter}>
                  <span>Manage appliances</span>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>

              <Link href="/customer/service-plans" className={styles.hubCard}>
                <div className={styles.hubCardTop}>
                  <div className={`${styles.hubCardIcon} ${styles.hubIconGreen}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className={styles.hubCardHeading}>Service Plans</h4>
                    <p className={styles.hubCardDesc}>
                      Track active AMC protection, remaining free visits, and plan expiration dates.
                    </p>
                  </div>
                </div>
                <div className={styles.hubCardFooter}>
                  <span>Check coverage</span>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>

              <Link href="/customer/service-requests" className={styles.hubCard}>
                <div className={styles.hubCardTop}>
                  <div className={`${styles.hubCardIcon} ${styles.hubIconBlue}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div>
                    <h4 className={styles.hubCardHeading}>Service Requests</h4>
                    <p className={styles.hubCardDesc}>
                      Monitor live technician assignment, in-progress jobs, and past service logs.
                    </p>
                  </div>
                </div>
                <div className={styles.hubCardFooter}>
                  <span>Track requests</span>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>

              <Link href="/customer/service-requests/new" className={styles.hubCard}>
                <div className={styles.hubCardTop}>
                  <div className={`${styles.hubCardIcon} ${styles.hubIconAmber}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className={styles.hubCardHeading}>Book New Service</h4>
                    <p className={styles.hubCardDesc}>
                      Request installation, routine maintenance, or report an urgent breakdown.
                    </p>
                  </div>
                </div>
                <div className={styles.hubCardFooter}>
                  <span>Book appointment</span>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            </div>
          </section>

          {/* Account Security & Sign Out Card */}
          <div className={styles.accountActionsCard}>
            <div className={styles.actionsCardTop}>
              <div className={styles.sessionSecurityInfo}>
                <div className={styles.securityIconWrap}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h4 className={styles.securityTitle}>Sign-in Security</h4>
                  <p className={styles.securityDesc}>
                    Authenticated as <strong>{profile.email}</strong> • Session secured
                  </p>
                </div>
              </div>

              <ProfileLogoutButton />
            </div>
          </div>
        </div>
      </div>

      <footer className={styles.appFooterNote}>
        <span>iTech V2</span>
        <span className={styles.footerDot} />
        <span>Care, connected</span>
        <span className={styles.footerDot} />
        <span>Customer Account</span>
      </footer>
    </div>
  );
}
