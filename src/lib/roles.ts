export const roles = ["admin", "technician", "customer"] as const;
export type Role = (typeof roles)[number];
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.some(role => role === value);
}
export const roleLabels: Record<Role, string> = {
  admin: "Admin", technician: "Technician", customer: "Customer",
};
export type Profile = { uid: string; email: string; displayName: string; role: Role };
