export type CustomerInput = {
  fullName: string; email: string; phone: string; alternatePhone: string;
  address: string; city: string; state: string; pincode: string; active: boolean;
};
export type CustomerRecord = CustomerInput & {
  id: string; ownerUid: string | null; createdAt: string; updatedAt: string;
};
export type CustomerErrors = Partial<Record<keyof CustomerInput, string>>;
export function normalizePhone(value: string): string {
  if (!/^[+0-9 ()-]*$/.test(value)) return "";
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}
export function validateCustomer(value: unknown): { data: CustomerInput | null; errors: CustomerErrors } {
  const errors: CustomerErrors = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return { data: null, errors: { fullName: "Enter customer details." } };
  const raw = value as Record<string, unknown>;
  const text = (key: string) => typeof raw[key] === "string" ? raw[key].trim().replace(/\s+/g, " ") : "";
  const data: CustomerInput = {
    fullName: text("fullName"), email: text("email").toLowerCase(),
    phone: normalizePhone(text("phone")), alternatePhone: normalizePhone(text("alternatePhone")),
    address: text("address"), city: text("city"), state: text("state"), pincode: text("pincode"),
    active: raw.active === true,
  };
  if (!data.fullName || data.fullName.length > 100) errors.fullName = "Enter a full name of up to 100 characters.";
  if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(data.email) || data.email.length > 254) errors.email = "Enter a valid email address.";
  if (!/^[1-9][0-9]{9}$/.test(data.phone)) errors.phone = "Enter a 10-digit Indian phone number; +91 is accepted.";
  if ((raw.alternatePhone !== undefined && typeof raw.alternatePhone !== "string") || text("alternatePhone") && !/^[1-9][0-9]{9}$/.test(data.alternatePhone)) errors.alternatePhone = "Enter a valid 10-digit alternate phone number.";
  for (const key of ["address", "city", "state"] as const) {
    if (!data[key] || data[key].length > (key === "address" ? 500 : 100)) errors[key] = "Enter a valid " + key + ".";
  }
  if (!/^[1-9][0-9]{5}$/.test(data.pincode)) errors.pincode = "Enter a valid 6-digit Indian pincode.";
  if (typeof raw.active !== "boolean") errors.active = "Choose Active or Inactive.";
  return { data: Object.keys(errors).length ? null : data, errors };
}
export function customerSearchTerm(value: string): string {
  const term = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (/^[+0-9 ()-]+$/.test(term)) {
    const digits = term.replace(/\D/g, "");
    return term.startsWith("+91") ? digits.slice(2) : normalizePhone(term);
  }
  return term;
}
