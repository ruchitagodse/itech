import { Icon } from "@/components/admin-dashboard/icons";
import { accountLabels, type AccountStatus } from "@/lib/admin-technicians/data";
import c from "@/components/admin-customers/customers.module.css";
export { CustomerAvatar as TechnicianAvatar, displayDate } from "@/components/admin-customers/shared";
export const count = (value: number | null | undefined) => value === null || value === undefined ? "—" : value.toLocaleString("en-IN");
export function AccountBadge({ status }: { status: AccountStatus }) { return <span className={`${c.badge} ${status === "active" ? c.positive : status === "unverified" ? c.amber : c.neutral}`}>{accountLabels[status]}</span>; }
export function NoJobs({ failed = false }: { failed?: boolean }) { return <div className={c.empty}><span className={c.emptyIcon}><Icon name="request"/></span><h3>{failed ? "Requests are temporarily unavailable" : "No requests to show"}</h3><p>{failed ? "Refresh the page to try again." : "Requests attributed to this technician will appear here."}</p></div>; }
