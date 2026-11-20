import { requireRole } from "@/lib/auth";
import { listServicePackages } from "@/lib/service-packages/server";
import { CustomerPackagesView } from "@/components/customer-packages/customer-packages-view";

export const metadata = { title: "Service catalogue" };

export default async function CustomerPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const profile = await requireRole("customer");
  const query = await searchParams;
  const cursor = typeof query.cursor === "string" ? query.cursor : "";
  const { items, nextCursor } = await listServicePackages(profile, cursor);

  return (
    <CustomerPackagesView
      items={items}
      cursor={cursor}
      nextCursor={nextCursor}
      basePath="/customer/service-packages"
    />
  );
}
