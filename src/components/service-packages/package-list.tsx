import Link from "next/link";
import { applianceTypes } from "@/lib/appliances/data";
import { serviceTypes } from "@/lib/service-requests/data";
import { packagePrice, type ServicePackageRecord } from "@/lib/service-packages/data";
export function PackageList({ items, admin = false }: { items: ServicePackageRecord[]; admin?: boolean }) {
  if (!items.length) return <section className="customer-empty"><h2>{admin?"No packages added yet":"No packages available"}</h2><p className="muted">{admin?"Add your first installation or maintenance offering.":"Active service packages will appear here when available."}</p>{admin&&<Link className="button secondary" href="/admin/service-packages/new">Add package</Link>}</section>;
  return <div className="dashboard-grid appliance-list-space">{items.map(item=><article className="dashboard-card package-card" key={item.id}>
    <span className="eyebrow">{applianceTypes[item.applianceType]} · {serviceTypes[item.serviceType]}</span><h2>{item.name}</h2>
    <div className="package-price">{packagePrice(item.pricePaise)}</div><p className="package-description">{item.description}</p>
    {admin&&<div className="package-actions"><span className={"customer-status "+(item.active?"is-active":"is-inactive")}>{item.active?"Active":"Inactive"}</span><Link className="text-button" href={"/admin/service-packages/"+item.id+"/edit"}>Edit package →</Link></div>}
  </article>)}</div>;
}
export function PackagePagination({ cursor, nextCursor, basePath }: { cursor: string; nextCursor: string | null; basePath: string }) {
  return <div className="customer-pagination"><span>Up to 25 packages per page</span><div>{cursor&&<Link className="button secondary" href={basePath}>First page</Link>}{nextCursor&&<Link className="button secondary" href={basePath+"?cursor="+encodeURIComponent(nextCursor)}>Next page →</Link>}</div></div>;
}
