import Link from "next/link";
import type { Profile } from "@/lib/roles";
import type { ownPlanOverview } from "@/lib/service-plans/server";
import type { PlanRecord } from "@/lib/service-plans/data";
import type { LifecycleRow } from "@/lib/lifecycle/server";
import { requestStatuses, serviceTypes, type ServiceRequestRecord } from "@/lib/service-requests/data";
import { applianceTypes } from "@/lib/appliances/data";
import { indiaDate } from "@/lib/service-plans/data";
import Image from "next/image";
import { LogoutButton } from "@/components/logout-button";
import { HomeIcon } from "./icons";
import styles from "./home.module.css";

type Overview = Awaited<ReturnType<typeof ownPlanOverview>>;
type Props = { profile: Profile; overview: Overview; requests: ServiceRequestRecord[]; openRequests: string; schedule: LifecycleRow[]; moreSchedule: boolean; renewals: LifecycleRow[] };
const planLabels = { active: "Active", expired: "Expired", upcoming: "Upcoming", exhausted: "All visits used" };
function date(value: string, compact = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: compact ? "short" : "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value + "T12:00:00Z"));
}
function SectionHeading({ title, href, action }: { title: string; href: string; action: string }) {
  return <div className={styles.sectionHeading}><h2>{title}</h2><Link href={href}>{action}<HomeIcon name="arrow" /></Link></div>;
}
function PlanBadge({ plan }: { plan: PlanRecord | null }) {
  return <span className={styles.badge} data-tone={plan?.status === "active" ? "positive" : plan?.status === "expired" ? "warning" : "neutral"}><span />{plan ? planLabels[plan.status] : "No plan attached"}</span>;
}
function Empty({ icon, title, text, href, action }: { icon: "appliance" | "calendar" | "request" | "shield" | "profile"; title: string; text: string; href: string; action: string }) {
  return <div className={styles.empty}><span className={styles.emptyIcon}><HomeIcon name={icon} /></span><h3>{title}</h3><p>{text}</p><Link className={styles.inlineLink} href={href}>{action}<HomeIcon name="arrow" /></Link></div>;
}
export function CustomerHome({ profile, overview, requests, openRequests, schedule, moreSchedule, renewals }: Props) {
  const today = indiaDate();
  const firstName = profile.displayName.trim().split(/\s+/)[0] || "there";
  const initials = profile.displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(name => name[0])
    .join("")
    .toUpperCase();
  const active = overview.items.filter(item => item.current?.status === "active").length;
  const upcoming = schedule
    .filter(item => typeof item.dueOn === "string" && item.dueOn >= today && String(item.expiresOn) >= today && item.status !== "completed")
    .slice(0, 3);
  const waiting = renewals.filter(item => item.status === "awaiting_customer" || item.status === "agreed");
  const planItems = overview.items.filter(item => item.current || item.upcoming);
  const renewalsScheduled = overview.items.filter(item => item.current && item.upcoming);
  const cutoff = new Date(today + "T12:00:00Z");
  cutoff.setUTCDate(cutoff.getUTCDate() + 30);
  const expiring = overview.items.filter(
    item => item.current && !item.upcoming && (item.current.status === "expired" || item.current.expiresOn <= cutoff.toISOString().slice(0, 10))
  );

  const activeRequests = requests.filter(r => r.status === "pending" || r.status === "in_progress");
  const primaryActiveRequest = activeRequests[0];

  return (
    <div className={styles.dashboard}>
      <header className={styles.appHeader}>
        <div className={styles.headerTopRow}>
          <div className={styles.mobileBrand}>
            <Image
              src="/itech-logo.jpeg"
              alt="iTech — Pure Water. Healthy Life."
              width={140}
              height={46}
              className={styles.logoImage}
            />
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.iconButton} href="/customer/lifecycle?view=notifications" aria-label="Notification history">
              <HomeIcon name="bell" />
            </Link>
            <Link className={styles.avatar} href="/customer/profile" aria-label={"View profile for " + profile.displayName}>
              {initials}
            </Link>
          </div>
        </div>
        <div className={styles.headerContent}>
          <p className={styles.kicker}>YOUR CUSTOMER HOME</p>
          <h1>Hello, {firstName}.</h1>
          <p className={styles.intro}>A little care. A more comfortable home.</p>
        </div>
      </header>

      {!overview.customer ? (
        <section className={styles.panel}>
          <Empty
            icon="profile"
            title="Let’s connect your home"
            text="Your customer profile isn’t linked yet. Ask your administrator to link your record so your appliances and care plans can appear here."
            href="/customer/profile"
            action="View my profile"
          />
        </section>
      ) : (
        <>
          {!overview.customer.active && (
            <p className={styles.notice} role="status">
              Your customer record is inactive. Contact your administrator before requesting service.
            </p>
          )}

          <section className={styles.hero} aria-labelledby="care-title">
            <div className={styles.heroTop}>
              <div>
                <p className={styles.heroEyebrow}>CARE THAT KEEPS LIFE RUNNING</p>
                <h2 id="care-title">Comfort, cared for.</h2>
                <p>
                  Your appliances, service and peace of mind.<br />Together in one place.
                </p>
              </div>
              <span className={styles.heroIcon}>
                <HomeIcon name="shield" />
              </span>
            </div>
            <div className={styles.metrics}>
              <Link href="/customer/appliances" className={styles.metricItem}>
                <strong>
                  {overview.items.length}
                  {overview.nextCursor ? "+" : ""}
                </strong>
                <span>Appliances</span>
              </Link>
              <Link href="/customer/service-plans" className={styles.metricItem}>
                <strong>{active}</strong>
                <span>{overview.nextCursor ? "Active plans shown" : "Active plans"}</span>
              </Link>
              <Link href="/customer/service-requests" className={styles.metricItem}>
                <strong>{openRequests}</strong>
                <span>Open requests</span>
              </Link>
            </div>
            <div className={styles.heroActions}>
              <Link href="/customer/appliances" className={styles.heroButton}>
                <HomeIcon name="plus" />Request a service<HomeIcon name="arrow" />
              </Link>
              <Link href="/customer/service-packages" className={styles.heroSecondaryAction}>
                Explore services<HomeIcon name="arrow" />
              </Link>
            </div>
          </section>

          {primaryActiveRequest && (
            <section className={styles.activeTracker} aria-label="Active service request">
              <div className={styles.activeTrackerHeader}>
                <div className={styles.activeTrackerBadge} data-status={primaryActiveRequest.status}>
                  <span className={styles.pulseDot} />
                  <strong>
                    {primaryActiveRequest.status === "in_progress" ? "Service in progress" : "Service requested"}
                  </strong>
                </div>
                <span className={styles.serviceTypeTag}>{serviceTypes[primaryActiveRequest.serviceType] || "Service"}</span>
              </div>
              <div className={styles.activeTrackerBody}>
                <div className={styles.activeTrackerInfo}>
                  <h3>{primaryActiveRequest.applianceLabel || "Appliance service"}</h3>
                  <p>
                    {primaryActiveRequest.assignedTechnicianName
                      ? "Technician: " + primaryActiveRequest.assignedTechnicianName
                      : "Awaiting technician assignment · Our team will review shortly"}
                  </p>
                </div>
                <Link href={"/customer/service-requests/" + primaryActiveRequest.id} className={styles.activeTrackerLink}>
                  Track request<HomeIcon name="arrow" />
                </Link>
              </div>
              <div className={styles.trackerTimeline}>
                <div className={styles.trackerStep} data-active="true">
                  <span className={styles.stepDot}><HomeIcon name="check" /></span>
                  <span className={styles.stepText}>Requested</span>
                </div>
                <div
                  className={styles.trackerLine}
                  data-filled={Boolean(primaryActiveRequest.assignedTechnicianName || primaryActiveRequest.status === "in_progress")}
                />
                <div
                  className={styles.trackerStep}
                  data-active={Boolean(primaryActiveRequest.assignedTechnicianName || primaryActiveRequest.status === "in_progress")}
                >
                  <span className={styles.stepDot}>
                    {primaryActiveRequest.assignedTechnicianName ? <HomeIcon name="check" /> : <HomeIcon name="clock" />}
                  </span>
                  <span className={styles.stepText}>
                    {primaryActiveRequest.assignedTechnicianName ? "Assigned" : "Assigning"}
                  </span>
                </div>
                <div
                  className={styles.trackerLine}
                  data-filled={primaryActiveRequest.status === "in_progress"}
                />
                <div
                  className={styles.trackerStep}
                  data-active={primaryActiveRequest.status === "in_progress"}
                >
                  <span className={styles.stepDot}>
                    {primaryActiveRequest.status === "in_progress" ? <HomeIcon name="wrench" /> : <HomeIcon name="request" />}
                  </span>
                  <span className={styles.stepText}>In progress</span>
                </div>
              </div>
            </section>
          )}

          <div className={styles.contentGrid}>
            <div className={styles.primaryColumn}>
              <section aria-label="My appliances">
                <SectionHeading title="My appliances" href="/customer/appliances" action="View all" />
                {!overview.items.length ? (
                  <div className={styles.panel}>
                    <Empty
                      icon="appliance"
                      title="Your home starts here"
                      text="Once your administrator registers an appliance, its details and care plan will appear here."
                      href="/customer/profile"
                      action="View my profile"
                    />
                  </div>
                ) : (
                  <div className={styles.applianceGrid}>
                    {overview.items.slice(0, 4).map(({ appliance, current, upcoming: next }) => {
                      const plan = current ?? next;
                      return (
                        <article className={styles.applianceCard} key={appliance.id}>
                          <div className={styles.cardTop}>
                            <span className={styles.applianceIcon} data-type={appliance.type}>
                              <HomeIcon name={appliance.type === "ac" ? "ac" : "water"} />
                            </span>
                            <PlanBadge plan={plan} />
                          </div>
                          <p className={styles.cardCategory}>{applianceTypes[appliance.type]}</p>
                          <h3>
                            {appliance.brand} {appliance.model}
                          </h3>
                          <p className={styles.installDate}>
                            {appliance.installationDate
                              ? "Installed " + date(appliance.installationDate, true)
                              : "Installation date not recorded"}
                          </p>
                          <div className={styles.appliancePlan}>
                            {plan ? (
                              <>
                                <span>
                                  {plan.status === "upcoming"
                                    ? "Starts " + date(plan.startsOn, true)
                                    : "Valid through " + date(plan.expiresOn, true)}
                                </span>
                                <strong>
                                  {plan.status === "upcoming"
                                    ? plan.totalServices - plan.usedServices
                                    : plan.remainingServices}{" "}
                                  <small>
                                    {plan.status === "upcoming"
                                      ? "visits when plan starts"
                                      : plan.remainingServices === 1
                                      ? "visit remaining"
                                      : "visits remaining"}
                                  </small>
                                </strong>
                              </>
                            ) : (
                              <p>Service care, whenever you need it.</p>
                            )}
                          </div>
                          {!appliance.active && <p className={styles.inactive}>Appliance inactive</p>}
                          <Link
                            className={styles.cardLink}
                            href={"/customer/appliances/" + appliance.id}
                            aria-label={"View " + appliance.brand + " " + appliance.model}
                          >
                            View appliance
                            <HomeIcon name="arrow" />
                          </Link>
                        </article>
                      );
                    })}
                  </div>
                )}
                {overview.nextCursor && <p className={styles.caption}>Showing the latest appliances. View all to see more.</p>}
              </section>

              <section>
                <SectionHeading title="Your service plans" href="/customer/service-plans" action="All plans" />
                <p className={styles.sectionIntro}>Included care, with every visit accounted for.</p>
                {!planItems.length ? (
                  <div className={styles.panel}>
                    <Empty
                      icon="shield"
                      title="Care that goes further"
                      text="Attached service plans and their included maintenance visits will appear here. You can still request other services."
                      href="/customer/service-packages"
                      action="Explore service catalogue"
                    />
                  </div>
                ) : (
                  <div className={styles.planList}>
                    {planItems.slice(0, 3).map(({ appliance, current, upcoming: next }) => {
                      const plan = (current ?? next)!;
                      const canBook =
                        overview.customer!.active && appliance.active && current?.status === "active" && current.remainingServices > 0;
                      return (
                        <article className={styles.planCard} key={appliance.id}>
                          <div className={styles.planCardHeading}>
                            <span className={styles.smallIcon}>
                              <HomeIcon name="shield" />
                            </span>
                            <div>
                              <h3>{plan.name}</h3>
                              <p>
                                {appliance.brand} {appliance.model}
                              </p>
                            </div>
                            <PlanBadge plan={plan} />
                          </div>
                          <p className={styles.planDates}>
                            {date(plan.startsOn)} — {date(plan.expiresOn)}
                            <span>Valid through expiry date · IST</span>
                          </p>
                          <div className={styles.visitLabels}>
                            <span>
                              <strong>{plan.usedServices}</strong> used of {plan.totalServices}
                            </span>
                            <strong>
                              {plan.status === "upcoming"
                                ? plan.totalServices - plan.usedServices + " when period starts"
                                : plan.remainingServices + " remaining"}
                            </strong>
                          </div>
                          <progress
                            className={styles.progress}
                            value={Math.min(plan.usedServices, plan.totalServices)}
                            max={Math.max(1, plan.totalServices)}
                            aria-label={plan.name + ": " + plan.usedServices + " of " + plan.totalServices + " visits used"}
                          />
                          <p className={styles.planNote}>
                            {plan.status === "upcoming"
                              ? "Visits become available when this period starts."
                              : plan.status === "expired"
                              ? "This period has expired. Unused visits do not carry forward."
                              : "Included visits cover maintenance only."}
                          </p>
                          <div className={styles.planActions}>
                            {canBook && (
                              <Link
                                href={"/customer/service-requests/new?applianceId=" + appliance.id + "&serviceType=maintenance&free=1"}
                                className={styles.softButton}
                              >
                                Request maintenance
                                <HomeIcon name="arrow" />
                              </Link>
                            )}
                            {overview.customer!.active && appliance.active && (
                              <Link
                                className={styles.inlineLink}
                                href={"/customer/service-requests/new?applianceId=" + appliance.id + "&serviceType=repair"}
                              >
                                Report a complaint
                              </Link>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                <p className={styles.caption}>Installation, repairs and complaints are separate from included maintenance visits.</p>
              </section>
            </div>

            <div className={styles.secondaryColumn}>
              <section>
                <SectionHeading title="Upcoming care" href="/customer/lifecycle" action="Calendar" />
                <div className={styles.panel}>
                  {upcoming.length ? (
                    <>
                      <p className={styles.calendarNote}>Maintenance due dates, not booked appointments.</p>
                      <div className={styles.scheduleList}>
                        {upcoming.map(item => {
                          const due = String(item.dueOn);
                          const stage =
                            item.workflowStatus === "confirmed" ? "Work started" : item.requestId ? "Requested" : "Scheduled";
                          return (
                            <article className={styles.scheduleCard} key={String(item.id)}>
                              <div className={styles.dateTile}>
                                <strong>{new Date(due + "T12:00:00Z").getUTCDate()}</strong>
                                <span>
                                  {new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
                                    new Date(due + "T12:00:00Z")
                                  )}
                                </span>
                              </div>
                              <div className={styles.scheduleInfo}>
                                <p className={styles.cardCategory}>MAINTENANCE · {due.slice(0, 4)}</p>
                                <h3>{String(item.applianceLabel || "Appliance maintenance")}</h3>
                                <span className={styles.scheduleStatus}>{stage}</span>
                                <Link
                                  className={styles.inlineLink}
                                  href={item.requestId ? "/customer/service-requests/" + item.requestId : "/customer/lifecycle"}
                                >
                                  {item.requestId ? "Track request" : "View schedule"}
                                  <HomeIcon name="arrow" />
                                </Link>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <Empty
                      icon="calendar"
                      title={moreSchedule ? "More care on your calendar" : "Nothing coming up just yet"}
                      text={
                        moreSchedule
                          ? "Open your calendar to see more maintenance dates."
                          : "Your scheduled maintenance dates will appear here. Need help sooner? You can request service anytime."
                      }
                      href={moreSchedule ? "/customer/lifecycle" : "/customer/appliances"}
                      action={moreSchedule ? "View service calendar" : "Request a service"}
                    />
                  )}
                </div>
              </section>

              <section>
                <SectionHeading title="Service requests" href="/customer/service-requests" action="View all" />
                <div className={styles.panel}>
                  {requests.length ? (
                    <div className={styles.requestList}>
                      {requests.slice(0, 3).map(request => (
                        <Link className={styles.requestCard} key={request.id} href={"/customer/service-requests/" + request.id}>
                          <div className={styles.requestCardTop}>
                            <span className={styles.requestTypeTag}>{serviceTypes[request.serviceType]}</span>
                            <span
                              className={styles.badge}
                              data-tone={
                                request.status === "completed" ? "positive" : request.status === "pending" ? "warning" : "neutral"
                              }
                            >
                              {requestStatuses[request.status]}
                            </span>
                          </div>
                          <h3>{request.applianceLabel}</h3>
                          <p>
                            {request.assignedTechnicianName
                              ? "Technician: " + request.assignedTechnicianName
                              : "Awaiting technician assignment"}
                          </p>
                          <span className={styles.trackLink}>
                            Track request
                            <HomeIcon name="arrow" />
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon="request"
                      title="A little peace of mind"
                      text="No requests to track yet. Whenever your appliance needs attention, we’re here to help."
                      href="/customer/appliances"
                      action="Raise a service request"
                    />
                  )}
                </div>
              </section>

              {(waiting.length > 0 || renewalsScheduled.length > 0 || expiring.length > 0) && (
                <section className={styles.renewalPanel}>
                  <span className={styles.smallIcon}>
                    <HomeIcon name="shield" />
                  </span>
                  <p className={styles.kicker}>KEEP YOUR CARE GOING</p>
                  <h2>
                    {waiting.length
                      ? "A renewal update for you"
                      : renewalsScheduled.length
                      ? "Your next chapter of care"
                      : "Time to review your care"}
                  </h2>
                  <p>
                    {waiting.length
                      ? waiting.some(item => item.status === "awaiting_customer")
                        ? "A renewal proposal is ready for your review. Your agreement comes before Admin confirmation."
                        : "Your agreement is recorded. Admin confirmation is the next step."
                      : renewalsScheduled.length
                      ? "Your next plan period is confirmed. Your current plan and its visits stay separate."
                      : "A plan is expired or expires within 30 days. Review your coverage and contact your administrator about renewal."}
                  </p>
                  <Link
                    className={styles.inlineLink}
                    href={waiting.length ? "/customer/lifecycle?view=renewals" : "/customer/service-plans"}
                  >
                    {waiting.length ? "Review renewal" : "View plan details"}
                    <HomeIcon name="arrow" />
                  </Link>
                </section>
              )}
            </div>
          </div>
        </>
      )}

      <section className={styles.helpBar}>
        <span className={styles.smallIcon}>
          <HomeIcon name="shield" />
        </span>
        <div>
          <h2>A home that’s well looked after.</h2>
          <p>Water purifier &amp; air conditioning care, all in one place.</p>
        </div>
        <Link href="/customer/service-packages" className={styles.catalogueLink}>
          Service catalogue
          <HomeIcon name="arrow" />
        </Link>
      </section>

      <footer className={styles.homeFooter}>
        <span>
          iTech V2 <span>Care, connected.</span>
        </span>
        <LogoutButton />
      </footer>
    </div>
  );
}
