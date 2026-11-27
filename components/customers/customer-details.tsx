import type { CustomerRecord } from "@/lib/customers/data";
export function CustomerDetails({ customer, showLink = false }: { customer: CustomerRecord; showLink?: boolean }) {
  const entries = [
    ["Full name", customer.fullName], ["Email", customer.email], ["Phone", customer.phone],
    ["Alternate phone", customer.alternatePhone || "Not provided"], ["Address", customer.address],
    ["City", customer.city], ["State", customer.state], ["Pincode", customer.pincode],
    ["Created date", customer.createdAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(customer.createdAt)) : "Not available"],
    ["Status", customer.active ? "Active" : "Inactive"],
    ...(showLink ? [["Sign-in account", customer.ownerUid ? "Linked to a Customer account" : "No matching Customer account linked"]] : []),
  ];
  return <section className="customer-details-panel"><dl className="customer-details">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}
