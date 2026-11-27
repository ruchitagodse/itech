"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  serviceTypes,
  validateServiceRequest,
  type ServiceType,
  type RequestErrors,
} from "@/lib/service-requests/data";
import { HomeIcon } from "@/components/customer-home/icons";
import styles from "./requests.module.css";

type Props = {
  customerId: string;
  applianceId: string;
  customerName: string;
  applianceLabel: string;
  basePath?: string;
  initialType?: ServiceType;
  freeBooking?: boolean;
};

export function CustomerRequestFormView({
  customerId,
  applianceId,
  customerName,
  applianceLabel,
  basePath = "/customer/service-requests",
  initialType = "maintenance",
  freeBooking = false,
}: Props) {
  const [serviceType, setType] = useState<ServiceType>(initialType);
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<RequestErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const result = validateServiceRequest({
      customerId,
      applianceId,
      serviceType,
      description,
      useIncludedVisit: freeBooking && serviceType === "maintenance",
    });

    setErrors(result.errors);
    if (!result.data) return;

    setBusy(true);
    try {
      const response = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });

      const payload = await response.json();
      if (!response.ok) {
        setErrors(payload.errors ?? {});
        throw new Error(payload.error || "Could not submit the service request.");
      }

      router.push(`${basePath}/${payload.id}?saved=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the service request.");
      setBusy(false);
    }
  }

  const isWaterPurifier =
    applianceLabel.toLowerCase().includes("purifier") ||
    applianceLabel.toLowerCase().includes("ro") ||
    applianceLabel.toLowerCase().includes("water");

  return (
    <div className={styles.container}>
      <Link href={basePath} className={styles.backLink}>
        <HomeIcon name="arrow" style={{ transform: "rotate(180deg)" }} />
        <span>Back to service requests</span>
      </Link>

      <div className={styles.formCard}>
        <div className={styles.formApplianceBadge}>
          <HomeIcon name={isWaterPurifier ? "water" : "ac"} />
          <span>{applianceLabel}</span>
        </div>

        <h1 className={styles.heroTitle} style={{ marginBottom: "8px" }}>
          {initialType === "repair"
            ? "Report a Complaint"
            : freeBooking
            ? "Book Free Maintenance"
            : "Request Home Service"}
        </h1>

        <p className={styles.subtitle} style={{ marginBottom: "24px" }}>
          Customer record: <strong>{customerName}</strong>
        </p>

        {freeBooking && serviceType === "maintenance" && (
          <div className={styles.planBenefitBox} style={{ marginBottom: "20px" }}>
            <HomeIcon name="shield" />
            <div>
              <strong>Included Maintenance Booking</strong>
              <p style={{ margin: "2px 0 0" }}>
                You are booking an included maintenance visit. Availability will be verified; one visit is deducted only after verified completion within plan dates.
              </p>
            </div>
          </div>
        )}

        {serviceType === "repair" && (
          <div
            className={styles.planBenefitBox}
            style={{
              marginBottom: "20px",
              background: "var(--req-amber-soft)",
              borderColor: "#fde68a",
              color: "#92400e",
            }}
          >
            <HomeIcon name="wrench" />
            <div>
              <strong>Complaint / Repair Request</strong>
              <p style={{ margin: "2px 0 0" }}>
                Describe your issue below. Repair and breakdown complaints are separate and do not deduct from your included maintenance visit allowance.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className={styles.cancelAlert} style={{ background: "var(--req-crimson-soft)", borderColor: "#fecaca", color: "#991b1b" }}>
            <HomeIcon name="clock" />
            <div>
              <h4>Unable to submit request</h4>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Service Type Selection */}
          <div className={styles.formGroup}>
            <label htmlFor="service-type-select">Service category</label>
            <select
              id="service-type-select"
              className={styles.formSelect}
              value={serviceType}
              disabled={busy || freeBooking || initialType === "repair"}
              onChange={e => setType(e.target.value as ServiceType)}
            >
              {Object.entries(serviceTypes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {errors.serviceType && <p className={styles.formError}>{errors.serviceType}</p>}
          </div>

          {/* Description */}
          <div className={styles.formGroup}>
            <label htmlFor="request-description">Describe what you need help with</label>
            <textarea
              id="request-description"
              className={styles.formTextarea}
              rows={5}
              minLength={10}
              maxLength={2000}
              required
              value={description}
              disabled={busy}
              placeholder="e.g. Filter replacement due, TDS water taste check, cooling temperature issue..."
              aria-invalid={Boolean(errors.description)}
              onChange={e => setDescription(e.target.value)}
            />
            {errors.description ? (
              <p className={styles.formError}>{errors.description}</p>
            ) : (
              <p className={styles.formHelper}>Describe the issue or service requirements (10–2,000 characters).</p>
            )}
          </div>

          {/* What happens next reassuring card */}
          <div className={styles.formNotice}>
            <h4>
              <HomeIcon name="clock" />
              <span>What happens next?</span>
            </h4>
            <p>
              Our operations team reviews your request and assigns a certified technician. Appointments are confirmed after scheduling review. One active request per appliance and service type is permitted at a time.
            </p>
          </div>

          {/* Form Actions */}
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              <HomeIcon name="check" />
              <span>{busy ? "Submitting…" : "Submit service request"}</span>
            </button>
            <Link href={basePath} className={styles.outlineBtn}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
