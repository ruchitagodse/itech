import { requireRole } from "@/lib/auth";
import { ownPlanOverview } from "@/lib/service-plans/server";
import { listServiceRequests } from "@/lib/service-requests/server";
import { lifecyclePage } from "@/lib/lifecycle/server";
import { CustomerHome } from "@/components/customer-home/dashboard";

export const metadata = { title: "Your home" };

export default async function Page() {
  const profile = await requireRole("customer");
  const [overview, requests, pending, inProgress, schedule, renewals] = await Promise.all([
    ownPlanOverview(profile), listServiceRequests(profile),
    listServiceRequests(profile, "pending"), listServiceRequests(profile, "in_progress"),
    lifecyclePage(profile, "maintenanceSchedule"), lifecyclePage(profile, "renewals"),
  ]);
  return <CustomerHome profile={profile} overview={overview} requests={requests.items}
    openRequests={String(pending.items.length + inProgress.items.length) + (pending.nextCursor || inProgress.nextCursor ? "+" : "")}
    schedule={schedule.items} moreSchedule={Boolean(schedule.nextCursor)} renewals={renewals.items} />;
}
