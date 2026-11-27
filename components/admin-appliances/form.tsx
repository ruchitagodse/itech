"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  applianceTypes,
  validateAppliance,
  type ApplianceInput,
  type ApplianceRecord,
  type ApplianceErrors,
} from "@/lib/appliances/data";
import s from "./appliances.module.css";

const emptyInput: ApplianceInput = {
  type: "water_purifier",
  brand: "",
  model: "",
  serialNumber: "",
  purchaseDate: "",
  installationDate: "",
  notes: "",
  active: true,
};

export type CustomerOption = {
  id: string;
  fullName: string;
  phone?: string;
  city?: string;
};

export function AdminApplianceForm({
  customerId: propCustomerId,
  customerName: propCustomerName,
  customerList,
  appliance,
}: {
  customerId?: string;
  customerName?: string;
  customerList?: CustomerOption[];
  appliance?: ApplianceRecord;
}) {
  const router = useRouter();
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    propCustomerId || appliance?.customerId || (customerList?.[0]?.id ?? "")
  );
  const [values, setValues] = useState<ApplianceInput>(appliance ?? emptyInput);
  const [errors, setErrors] = useState<ApplianceErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isEdit = Boolean(appliance);
  const backUrl = propCustomerId
    ? `/admin/customers/${propCustomerId}${appliance ? `/appliances/${appliance.id}` : "/appliances"}`
    : "/admin/appliances";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!selectedCustomerId) {
      setError("Please select a customer for this appliance.");
      return;
    }

    const result = validateAppliance(values);
    setErrors(result.errors);
    if (!result.data) {
      return;
    }

    setBusy(true);

    try {
      const endpoint = `/api/customers/${selectedCustomerId}/appliances${
        appliance ? `/${appliance.id}` : ""
      }`;
      const response = await fetch(endpoint, {
        method: appliance ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });

      const payload = await response.json();
      if (!response.ok) {
        setErrors(payload.errors ?? {});
        throw new Error(payload.error || "Could not save the appliance record.");
      }

      router.push(`/admin/customers/${selectedCustomerId}/appliances/${payload.id}?saved=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save appliance.");
      setBusy(false);
    }
  }

  return (
    <div className={s.screen}>
      <Link className={s.backLink} href={backUrl}>
        ← Back
      </Link>

      <div className={s.pageHeading}>
        <div>
          <span className={s.eyebrow}>
            {isEdit ? "EDIT APPLIANCE RECORD" : "NEW APPLIANCE REGISTRATION"}
          </span>
          <h1>
            {isEdit ? `${appliance?.brand} ${appliance?.model}` : "Register Appliance"}
            <span>.</span>
          </h1>
          <p>
            {isEdit
              ? "Update technical specifications, serial identifiers, or service status."
              : "Register an air conditioner or water purifier under a customer profile."}
          </p>
        </div>
      </div>

      <section className={s.formPanel}>
        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 9,
                color: "#b91c1c",
                fontSize: 13.5,
                fontWeight: 600,
                marginBottom: 20,
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <div className={s.formGrid}>
            {/* Customer selector (if not fixed) */}
            <div className={`${s.field} ${s.fullWidth}`}>
              <label htmlFor="appliance-customer">Assigned Customer</label>
              {propCustomerId ? (
                <input
                  id="appliance-customer"
                  type="text"
                  readOnly
                  disabled
                  value={propCustomerName ? `${propCustomerName} (${propCustomerId})` : propCustomerId}
                  style={{ background: "#f8fafc", color: "#64748b" }}
                />
              ) : customerList && customerList.length > 0 ? (
                <select
                  id="appliance-customer"
                  value={selectedCustomerId}
                  disabled={busy}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                >
                  {customerList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} {c.city ? `(${c.city})` : ""} {c.phone ? `· ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="appliance-customer"
                  type="text"
                  placeholder="Enter customer ID"
                  value={selectedCustomerId}
                  disabled={busy}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                />
              )}
            </div>

            {/* Appliance Type */}
            <div className={s.field}>
              <label htmlFor="appliance-type">Appliance Category</label>
              <select
                id="appliance-type"
                value={values.type}
                disabled={busy}
                onChange={e => setValues({ ...values, type: e.target.value as ApplianceInput["type"] })}
              >
                {Object.entries(applianceTypes).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              {errors.type && <p className={s.fieldError}>{errors.type}</p>}
            </div>

            {/* Status */}
            <div className={s.field}>
              <label htmlFor="appliance-status">Record Status</label>
              <select
                id="appliance-status"
                value={values.active ? "active" : "inactive"}
                disabled={busy}
                onChange={e => setValues({ ...values, active: e.target.value === "active" })}
              >
                <option value="active">Active (in service)</option>
                <option value="inactive">Inactive (decommissioned)</option>
              </select>
              {errors.active && <p className={s.fieldError}>{errors.active}</p>}
            </div>

            {/* Brand */}
            <div className={s.field}>
              <label htmlFor="appliance-brand">Brand / Manufacturer *</label>
              <input
                id="appliance-brand"
                type="text"
                maxLength={80}
                required
                placeholder="e.g. Daikin, Kent, Voltas, Aquaguard"
                value={values.brand}
                disabled={busy}
                aria-invalid={Boolean(errors.brand)}
                onChange={e => setValues({ ...values, brand: e.target.value })}
              />
              {errors.brand && <p className={s.fieldError}>{errors.brand}</p>}
            </div>

            {/* Model */}
            <div className={s.field}>
              <label htmlFor="appliance-model">Model Name / Number *</label>
              <input
                id="appliance-model"
                type="text"
                maxLength={100}
                required
                placeholder="e.g. FTKF50, Grand Plus RO, Inverter 1.5T"
                value={values.model}
                disabled={busy}
                aria-invalid={Boolean(errors.model)}
                onChange={e => setValues({ ...values, model: e.target.value })}
              />
              {errors.model && <p className={s.fieldError}>{errors.model}</p>}
            </div>

            {/* Serial Number */}
            <div className={`${s.field} ${s.fullWidth}`}>
              <label htmlFor="appliance-serial">Serial Number (optional)</label>
              <input
                id="appliance-serial"
                type="text"
                maxLength={80}
                placeholder="e.g. DKN-2024-883921"
                value={values.serialNumber}
                disabled={busy}
                aria-invalid={Boolean(errors.serialNumber)}
                onChange={e => setValues({ ...values, serialNumber: e.target.value })}
              />
              <span style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                Spaces are stripped and converted to uppercase. Must be unique per brand.
              </span>
              {errors.serialNumber && <p className={s.fieldError}>{errors.serialNumber}</p>}
            </div>

            {/* Purchase Date */}
            <div className={s.field}>
              <label htmlFor="appliance-purchase">Purchase Date (optional)</label>
              <input
                id="appliance-purchase"
                type="date"
                value={values.purchaseDate}
                disabled={busy}
                aria-invalid={Boolean(errors.purchaseDate)}
                onChange={e => setValues({ ...values, purchaseDate: e.target.value })}
              />
              {errors.purchaseDate && <p className={s.fieldError}>{errors.purchaseDate}</p>}
            </div>

            {/* Installation Date */}
            <div className={s.field}>
              <label htmlFor="appliance-install">Installation Date (optional)</label>
              <input
                id="appliance-install"
                type="date"
                value={values.installationDate}
                disabled={busy}
                aria-invalid={Boolean(errors.installationDate)}
                onChange={e => setValues({ ...values, installationDate: e.target.value })}
              />
              {errors.installationDate && <p className={s.fieldError}>{errors.installationDate}</p>}
            </div>

            {/* Notes */}
            <div className={`${s.field} ${s.fullWidth}`}>
              <label htmlFor="appliance-notes">Location / Technician Notes (optional)</label>
              <textarea
                id="appliance-notes"
                rows={3}
                maxLength={1000}
                placeholder="e.g. Installed in master bedroom 2nd floor, outdoor unit on balcony terrace"
                value={values.notes}
                disabled={busy}
                aria-invalid={Boolean(errors.notes)}
                onChange={e => setValues({ ...values, notes: e.target.value })}
              />
              {errors.notes && <p className={s.fieldError}>{errors.notes}</p>}
            </div>
          </div>

          <div className={s.formActions}>
            <button className={s.primary} type="submit" disabled={busy}>
              {busy ? "Saving appliance…" : isEdit ? "Save changes" : "Register appliance"}
            </button>
            <Link className={s.outline} href={backUrl}>
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
