export function indiaDate(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map(part => [part.type, part.value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
}
export function validPlanDate(value) {
  if (typeof value !== "string" || !/^(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function planBalance(plan, today = indiaDate()) {
  const unused = Math.max(0, plan.totalServices - plan.usedServices);
  const status = today < plan.startsOn ? "upcoming" : today > plan.expiresOn ? "expired" : unused === 0 ? "exhausted" : "active";
  return { status, remainingServices: status === "active" ? unused : 0, expiredServices: status === "expired" ? unused : 0 };
}
