export const serviceTypes = { installation: "Installation", maintenance: "Maintenance", repair: "Repair / complaint" } as const;
export const requestStatuses = { pending: "Pending", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" } as const;
export type ServiceType = keyof typeof serviceTypes;
export type RequestStatus = keyof typeof requestStatuses;
export type ServiceRequestInput = { customerId: string; applianceId: string; serviceType: ServiceType; description: string; useIncludedVisit?: boolean };
export type ServiceRequestRecord = ServiceRequestInput & {
  id: string; status: RequestStatus; createdAt: string; updatedAt: string;
  customerName: string; applianceLabel: string;
  visitId?: string | null; schemaVersion?: number | null;
  servicePlanId: string | null; servicePlanName: string; servicePlanOutcome: string; servicePlanCreditUsed: boolean;
  assignedTechnicianUid: string | null; assignedTechnicianName: string; assignmentVersion: number; assignmentUpdatedAt: string;
};
export type RequestErrors = Partial<Record<keyof ServiceRequestInput, string>>;
export function validId(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value); }
export function isStatus(value: unknown): value is RequestStatus { return typeof value === "string" && Object.hasOwn(requestStatuses, value); }
export function nextStatuses(status: RequestStatus): RequestStatus[] {
  return status === "pending" ? ["in_progress", "cancelled"] : status === "in_progress" ? ["completed", "cancelled"] : [];
}
export function validateServiceRequest(value: unknown): { data: ServiceRequestInput | null; errors: RequestErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { data: null, errors: { description: "Enter request details." } };
  const raw = value as Record<string, unknown>;
  const data: ServiceRequestInput = {
    customerId: typeof raw.customerId === "string" ? raw.customerId : "",
    applianceId: typeof raw.applianceId === "string" ? raw.applianceId : "",
    serviceType: raw.serviceType as ServiceType,
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    useIncludedVisit: raw.useIncludedVisit === true,
  };
  const errors: RequestErrors = {};
  if (!validId(data.customerId)) errors.customerId = "Choose a customer.";
  if (!validId(data.applianceId)) errors.applianceId = "Choose an appliance.";
  if (typeof data.serviceType !== "string" || !Object.hasOwn(serviceTypes, data.serviceType)) errors.serviceType = "Choose a service type.";
  if (raw.useIncludedVisit !== undefined && typeof raw.useIncludedVisit !== "boolean") errors.serviceType = "Choose a valid service request.";
  if (data.useIncludedVisit && data.serviceType !== "maintenance") errors.serviceType = "Included visits are for maintenance only.";
  if (data.description.length < 10 || data.description.length > 2000) errors.description = "Describe the issue in 10–2,000 characters.";
  return { data: Object.keys(errors).length ? null : data, errors };
}
