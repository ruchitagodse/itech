import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listServicePackages } from "@/lib/service-packages/server";
import { PackageList, PackagePagination } from "@/components/service-packages/package-list";
export const metadata = { title: "Service packages" };
export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ cursor?: string; saved?: string }> }) {
  const profile = await requireRole("admin");
  const query = await searchParams;
  const cursor = typeof query.cursor === "string" ? query.cursor : "";
  const { items,nextCursor } = await listServicePackages(profile,cursor);
  return <><div className="page-heading"><div><span className="eyebrow">SERVICE CATALOGUE</span><h1>Service packages<span className="welcome-dot">.</span></h1><p className="muted">Manage the offerings shown to Customers.</p></div><Link className="button primary" href="/admin/service-packages/new">+ Add package</Link></div>
  {query.saved==="1"&&<div className="message success customer-success" role="status">Package saved successfully.</div>}
  <PackageList items={items} admin={true} /><PackagePagination cursor={cursor} nextCursor={nextCursor} basePath="/admin/service-packages" /></>;
}
