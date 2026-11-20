import { requireRole } from "@/lib/auth";
import { ownPlanOverview } from "@/lib/service-plans/server";
import { lifecyclePage } from "@/lib/lifecycle/server";
import { CustomerPlansView } from "@/components/customer-plans/customer-plans-view";

export const metadata = { title: "My service plans" };

export default async function MyServicePlansPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const profile = await requireRole("customer");
  const query = await searchParams;
  const cursor = typeof query.cursor === "string" ? query.cursor : "";
  const [overview, renewals] = await Promise.all([
    ownPlanOverview(profile, cursor),
    lifecyclePage(profile, "renewals").catch(() => ({ items: [] })),
  ]);

  return (
    <CustomerPlansView
      customer={overview.customer}
      items={overview.items}
      renewals={renewals.items}
      nextCursor={overview.nextCursor}
      cursor={cursor}
    />
  );
}
