import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ownCustomer } from "@/lib/customers/server";
import { requestContext } from "@/lib/service-requests/server";
import type { ServiceType } from "@/lib/service-requests/data";
import { CustomerRequestFormView } from "@/components/customer-requests/customer-request-form-view";

export const metadata = { title: "New service request" };

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{
    customerId?: string;
    applianceId?: string;
    serviceType?: string;
    free?: string;
  }>;
}) {
  const profile = await requireRole("customer");
  const query = await searchParams;
  const own = await ownCustomer(profile);
  const initialType: ServiceType =
    query.serviceType === "repair"
      ? "repair"
      : query.serviceType === "installation"
      ? "installation"
      : "maintenance";
  const freeBooking = query.free === "1" && initialType === "maintenance";
  const customerId = own?.id ?? "";
  const applianceId = typeof query.applianceId === "string" ? query.applianceId : "";

  if (!customerId || !applianceId) {
    return (
      <section className="customer-empty">
        <h1>Choose an appliance first</h1>
        <p className="muted">Open the appliance you need help with, then choose Request service.</p>
        <Link className="button primary" href="/customer/appliances">
          View my appliances
        </Link>
      </section>
    );
  }

  const { customer, appliance } = await requestContext(profile, customerId, applianceId);
  if (!customer || !appliance) notFound();

  if (!customer.active || !appliance.active) {
    return (
      <section className="customer-empty">
        <h2>This record is inactive</h2>
        <p className="muted">
          New service requests require an active customer and appliance. Contact your administrator.
        </p>
      </section>
    );
  }

  return (
    <CustomerRequestFormView
      customerId={customer.id}
      applianceId={appliance.id}
      customerName={customer.fullName}
      applianceLabel={`${appliance.brand} ${appliance.model}`}
      basePath="/customer/service-requests"
      initialType={initialType}
      freeBooking={freeBooking}
    />
  );
}
