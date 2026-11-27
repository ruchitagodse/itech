import { applianceTypes, type ApplianceRecord } from "@/lib/appliances/data";
export function ApplianceDetails({ appliance }: { appliance: ApplianceRecord }) {
  const rows = [
    ["Type", applianceTypes[appliance.type]], ["Brand", appliance.brand], ["Model", appliance.model],
    ["Serial number", appliance.serialNumber || "Not provided"], ["Purchase date", appliance.purchaseDate || "Not provided"],
    ["Installation date", appliance.installationDate || "Not provided"], ["Status", appliance.active ? "Active" : "Inactive"],
    ["Created date", appliance.createdAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(appliance.createdAt)) : "Not available"],
    ["Notes", appliance.notes || "No notes"],
  ];
  return <section className="customer-details-panel"><dl className="customer-details appliance-details">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}
