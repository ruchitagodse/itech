export const applianceTypes = { water_purifier: "Water purifier", ac: "Air conditioner" } as const;
export type ApplianceType = keyof typeof applianceTypes;
export type ApplianceInput = {
  type: ApplianceType; brand: string; model: string; serialNumber: string;
  purchaseDate: string; installationDate: string; notes: string; active: boolean;
};
export type ApplianceRecord = ApplianceInput & { id: string; customerId: string; createdAt: string; updatedAt: string };
export type ApplianceErrors = Partial<Record<keyof ApplianceInput, string>>;
function validDate(value: string) {
  if (!value) return true;
  if (!/^(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateAppliance(value: unknown): { data: ApplianceInput | null; errors: ApplianceErrors } {
  const errors: ApplianceErrors = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return { data: null, errors: { type: "Enter appliance details." } };
  const raw = value as Record<string, unknown>;
  const text = (key: string) => typeof raw[key] === "string" ? raw[key].trim() : "";
  const data: ApplianceInput = {
    type: raw.type === "ac" ? "ac" : "water_purifier",
    brand: text("brand").replace(/\s+/g, " "), model: text("model").replace(/\s+/g, " "),
    serialNumber: text("serialNumber").replace(/\s+/g, "").toUpperCase(),
    purchaseDate: text("purchaseDate"), installationDate: text("installationDate"), notes: text("notes"), active: raw.active === true,
  };
  if (raw.type !== "water_purifier" && raw.type !== "ac") errors.type = "Choose Water purifier or Air conditioner.";
  if (!data.brand || data.brand.length > 80 || /[/|\u0000-\u001f]/.test(data.brand)) errors.brand = "Enter a brand of up to 80 characters without / or |.";
  if (!data.model || data.model.length > 100) errors.model = "Enter a model of up to 100 characters.";
  for (const key of ["serialNumber", "purchaseDate", "installationDate", "notes"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") errors[key] = "Enter a valid value.";
  }
  if (data.serialNumber && !/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(data.serialNumber)) errors.serialNumber = "Use up to 80 letters, numbers, dots, underscores or hyphens.";
  if (!validDate(data.purchaseDate)) errors.purchaseDate = "Enter a valid purchase date.";
  if (!validDate(data.installationDate)) errors.installationDate = "Enter a valid installation date.";
  if (data.purchaseDate && data.installationDate && data.installationDate < data.purchaseDate) errors.installationDate = "Installation cannot be before purchase.";
  if (data.notes.length > 1000) errors.notes = "Keep notes within 1,000 characters.";
  if (typeof raw.active !== "boolean") errors.active = "Choose Active or Inactive.";
  return { data: Object.keys(errors).length ? null : data, errors };
}
