import Link from "next/link";
import { Icon } from "@/components/admin-dashboard/icons";
import type { ApplianceType } from "@/lib/appliances/data";
import type { CoverageStatus } from "@/lib/admin-appliances/data";
import s from "./appliances.module.css";

export function ApplianceAvatar({ type }: { type: ApplianceType }) {
  return (
    <span className={s.applianceAvatar} aria-hidden="true">
      {type === "ac" ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="10" rx="2" />
          <path d="M6 15v3m12-3v3M9 10h6M6 19h12" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          <path d="M8 14c1 1.5 2.5 2 4 2s3-.5 4-2" />
        </svg>
      )}
    </span>
  );
}

export function ApplianceTypeBadge({ type }: { type: ApplianceType }) {
  if (type === "ac") {
    return (
      <span className={`${s.badge} ${s.badgeBlue}`}>
        <span className={s.badgeDot} />
        Air Conditioner
      </span>
    );
  }
  return (
    <span className={`${s.badge} ${s.badgePositive}`}>
      <span className={s.badgeDot} />
      Water Purifier
    </span>
  );
}

export function CoverageBadge({ status }: { status?: CoverageStatus | null }) {
  if (status === "active") {
    return (
      <span className={`${s.badge} ${s.badgePositive}`}>
        <span className={s.badgeDot} />
        Active coverage
      </span>
    );
  }
  if (status === "expired" || status === "exhausted") {
    return (
      <span className={`${s.badge} ${s.badgeWarning}`}>
        <span className={s.badgeDot} />
        {status === "exhausted" ? "Visits exhausted" : "Expired"}
      </span>
    );
  }
  if (status === "upcoming") {
    return (
      <span className={`${s.badge} ${s.badgeBlue}`}>
        <span className={s.badgeDot} />
        Upcoming
      </span>
    );
  }
  return (
    <span className={`${s.badge} ${s.badgeNeutral}`}>
      <span className={s.badgeDot} />
      No plan
    </span>
  );
}

export function RecordStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`${s.badge} ${active ? s.badgePositive : s.badgeNeutral}`}>
      <span className={s.badgeDot} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function displayDate(value?: string | null): string {
  if (!value) return "Not provided";
  const date = new Date(value.length === 10 ? value + "T00:00:00+05:30" : value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(date);
}

export function PageHeader({
  title,
  subtitle,
  addHref,
  count,
}: {
  title: string;
  subtitle: string;
  addHref?: string;
  count?: number;
}) {
  return (
    <div className={s.pageHeading}>
      <div>
        <span className={s.eyebrow}>APPLIANCE MANAGEMENT</span>
        <h1>
          {title}
          <span>.</span>
          {typeof count === "number" && (
            <span className={s.countPill} style={{ verticalAlign: "middle", marginLeft: 10, fontSize: 14 }}>
              {count}
            </span>
          )}
        </h1>
        <p>{subtitle}</p>
      </div>
      {addHref && (
        <Link className={s.primary} href={addHref}>
          <Icon name="plus" />
          Add appliance
        </Link>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  text,
  actionHref,
  actionText,
}: {
  title: string;
  text: string;
  actionHref?: string;
  actionText?: string;
}) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>
        <Icon name="appliance" />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {actionHref && actionText && (
        <div style={{ marginTop: 16 }}>
          <Link className={s.secondary} href={actionHref}>
            {actionText}
          </Link>
        </div>
      )}
    </div>
  );
}
