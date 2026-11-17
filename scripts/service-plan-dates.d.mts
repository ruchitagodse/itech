export function indiaDate(date?: Date): string;
export function validPlanDate(value: unknown): boolean;
export function planBalance(plan: { startsOn: string; expiresOn: string; totalServices: number; usedServices: number }, today?: string): { status: "upcoming" | "expired" | "exhausted" | "active"; remainingServices: number; expiredServices: number };
