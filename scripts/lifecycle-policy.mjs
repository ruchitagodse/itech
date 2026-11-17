import { validPlanDate, indiaDate } from "./service-plan-dates.mjs";
export { indiaDate };
export function addMonths(value, months) {
  if (!validPlanDate(value) || !Number.isInteger(months) || months < 0 || months > 120) throw Error("invalid-date");
  const date = new Date(value + "T00:00:00Z"), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day,last));
  const result = date.toISOString().slice(0,10);
  if (!validPlanDate(result)) throw Error("invalid-date");
  return result;
}
export function plusDays(value, days) {
  if (!validPlanDate(value) || !Number.isInteger(days)) throw Error("invalid-date");
  const date = new Date(value + "T00:00:00Z"); date.setUTCDate(date.getUTCDate()+days);
  const result=date.toISOString().slice(0,10); if(!validPlanDate(result))throw Error("invalid-date"); return result;
}
export function validPolicy(policy) {
  return !!policy && Number.isInteger(policy.validityMonths) && policy.validityMonths >= 1 && policy.validityMonths <= 120
    && Number.isInteger(policy.maintenanceIntervalMonths) && policy.maintenanceIntervalMonths >= 1 && policy.maintenanceIntervalMonths <= 60;
}
export function period(start, policy) {
  if (!validPolicy(policy)) throw Error("policy-required");
  const expiresOn = addMonths(start, policy.validityMonths);
  const dueDates = [1, 2].map(number => addMonths(start, policy.maintenanceIntervalMonths * number));
  if (dueDates.some(date => date > expiresOn) || new Set(dueDates).size !== 2)
    throw Object.assign(new Error("Both included visits must fit within plan validity at the configured frequency."), { code: "schedule-conflict" });
  return { startsOn:start, expiresOn, totalServices:2, usedServices:0, schemaVersion:3,
    policy:{validityMonths:policy.validityMonths,maintenanceIntervalMonths:policy.maintenanceIntervalMonths},
    dueDates };
}
export function scheduleId(planId, visit) { return planId + "_" + visit; }
export function scheduleRows(data) {
  return data.dueDates.map((dueOn,index)=>({ customerId:data.customerId,applianceId:data.applianceId,planId:data.planId,
    planName:data.name, customerName:data.customerName,applianceLabel:data.applianceLabel,
    dueOn,startsOn:data.startsOn,expiresOn:data.expiresOn,visit:index+1,status:"due",workflowStatus:"scheduled",requestId:null }));
}
export function serviceDueStatus(row,today=indiaDate()) {
  if(row.status==="completed")return "completed";
  return today>row.expiresOn?"expired":today>row.dueOn?"overdue":today===row.dueOn?"due":"upcoming";
}
export const isId = value => typeof value==="string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
