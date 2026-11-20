import { requireRole } from "@/lib/auth";
import { lifecyclePage, ownConsent, type LifecycleView } from "@/lib/lifecycle/server";
import { CustomerLifecycleView } from "@/components/customer-lifecycle/customer-lifecycle-view";

export const metadata = { title: "Care & renewals" };

const customerViews: readonly LifecycleView[] = ["maintenanceSchedule", "renewals", "notifications"];

export default async function CustomerLifecyclePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireRole("customer");
  const search = await searchParams;

  const view: LifecycleView = customerViews.includes(search.view as LifecycleView)
    ? (search.view as LifecycleView)
    : "maintenanceSchedule";

  const cursor = typeof search.cursor === "string" ? search.cursor : "";
  const [{ items, nextCursor }, consent] = await Promise.all([
    lifecyclePage(profile, view, cursor),
    ownConsent(profile),
  ]);

  return (
    <CustomerLifecycleView
      profile={profile}
      view={view}
      items={items}
      nextCursor={nextCursor}
      cursor={cursor}
      consent={consent}
    />
  );
}