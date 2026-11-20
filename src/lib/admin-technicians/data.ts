export const accountLabels = { active: "Active", unverified: "Email unverified", disabled: "Sign-in disabled", inactive: "Profile inactive", missing: "Account missing", unavailable: "Status unavailable" } as const;
export type AccountStatus = keyof typeof accountLabels;
export type Workload = { assigned: number; pending: number; inProgress: number; completed: number };
export type Technician = { id: string; displayName: string; email: string; phone: string; profileActive: boolean; createdAt: string; emailVerified: boolean | null; signInDisabled: boolean | null; status: AccountStatus; workload: Workload | null };
export function accountStatus(active: boolean, account: { disabled: boolean; emailVerified: boolean } | null | undefined): AccountStatus {
  if (account === undefined) return "unavailable";
  if (account === null) return "missing";
  if (account.disabled) return "disabled";
  if (!active) return "inactive";
  return account.emailVerified ? "active" : "unverified";
}
export function workloadFor(rows: { assignedTechnicianUid: unknown; status: unknown }[]) {
  const result = new Map<string, Workload>();
  for (const row of rows) {
    if (typeof row.assignedTechnicianUid !== "string" || !row.assignedTechnicianUid) continue;
    const value = result.get(row.assignedTechnicianUid) ?? { assigned: 0, pending: 0, inProgress: 0, completed: 0 };
    if (row.status === "pending") { value.pending++; value.assigned++; }
    if (row.status === "in_progress") { value.inProgress++; value.assigned++; }
    if (row.status === "completed") value.completed++;
    result.set(row.assignedTechnicianUid, value);
  }
  return result;
}
export function matchesTechnician(t: Technician, query: string, status: string, workload: string) {
  const term = query.trim().toLocaleLowerCase("en-IN"), digits = term.replace(/\D/g, "");
  const textMatch = !term || t.displayName.toLocaleLowerCase("en-IN").includes(term) || t.email.toLocaleLowerCase("en-IN").includes(term);
  const phoneMatch = /^[+\d ()-]+$/.test(term) && digits.length > 0 && t.phone.replace(/\D/g, "").includes(digits);
  return (textMatch || phoneMatch) && (status === "all" || t.status === status)
    && (workload === "all" || workload === "assigned" && (t.workload?.assigned ?? 0) > 0 || workload === "progress" && (t.workload?.inProgress ?? 0) > 0);
}
export function validateTechnicianInput(name: string, email: string) {
  const errors: { displayName?: string; email?: string } = {};
  if (!name.trim() || name.trim().length > 100) errors.displayName = "Enter a full name of up to 100 characters.";
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";
  return errors;
}
