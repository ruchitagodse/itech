import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ownCustomer } from "@/lib/customers/server";
import { getAppliance } from "@/lib/appliances/server";
import { listAppliancePlans } from "@/lib/service-plans/server";
import { listServiceRequests } from "@/lib/service-requests/server";
import { CustomerApplianceDetailsView } from "@/components/customer-appliances/customer-appliance-details";

export const metadata = { title: "My appliance" };

export default async function MyAppliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ applianceId: string }>;
  searchParams: Promise<{ planCursor?: string }>;
}) {
  const profile = await requireRole("customer");
  const customer = await ownCustomer(profile);
  if (!customer) notFound();

  const { applianceId } = await params;
  const appliance = await getAppliance(profile, customer.id, applianceId);
  if (!appliance) notFound();

  const query = await searchParams;
  const planCursor = typeof query.planCursor === "string" ? query.planCursor : "";

  const [plans, requests] = await Promise.all([
    listAppliancePlans(profile, customer.id, appliance.id, planCursor),
    listServiceRequests(profile),
  ]);

  const applianceRequests = requests.items.filter(r => r.applianceId === appliance.id);

  return (
    <CustomerApplianceDetailsView
      appliance={appliance}
      currentPlan={plans.current}
      upcomingPlan={plans.upcoming}
      planHistory={plans.items}
      requests={applianceRequests}
      planCursor={planCursor}
      nextPlanCursor={plans.nextCursor}
    />
  );
}
