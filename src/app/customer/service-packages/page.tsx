import { requireRole } from "@/lib/auth";
import { listServicePackages } from "@/lib/service-packages/server";
import { PackageList, PackagePagination } from "@/components/service-packages/package-list";
export const metadata = { title: "Service packages" };
export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ cursor?: string; saved?: string }> }) {
  const profile = await requireRole("customer");
  const query = await searchParams;
  const cursor = typeof query.cursor === "string" ? query.cursor : "";
  const { items,nextCursor } = await listServicePackages(profile,cursor);
  return <><div className="page-heading"><div><span className="eyebrow">SERVICE CATALOGUE</span><h1>Service packages<span className="welcome-dot">.</span></h1><p className="muted">Explore water purifier and AC service offerings.</p></div></div>
  
  <PackageList items={items} admin={false} /><PackagePagination cursor={cursor} nextCursor={nextCursor} basePath="/customer/service-packages" /></>;
}
