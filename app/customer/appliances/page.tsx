import { requireRole } from "@/lib/auth";
import { ownPlanOverview } from "@/lib/service-plans/server";
import { CustomerApplianceList } from "@/components/customer-appliances/customer-appliance-list";

export const metadata = { title: "My appliances" };

export default async function MyAppliancesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const profile = await requireRole("customer");
  const cursor = (await searchParams).cursor;
  const safeCursor = typeof cursor === "string" ? cursor : "";
  const { customer, items, nextCursor } = await ownPlanOverview(profile, safeCursor);

  return (
    <CustomerApplianceList
      customer={customer}
      items={items}
      nextCursor={nextCursor}
      cursor={safeCursor}
    />
  );
}
