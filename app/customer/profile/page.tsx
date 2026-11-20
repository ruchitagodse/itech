import { requireRole } from "@/lib/auth";
import { ownCustomer } from "@/lib/customers/server";
import { CustomerProfileView } from "@/components/customer-profile/customer-profile-view";

export const metadata = { title: "My profile" };

export default async function MyProfilePage() {
  const profile = await requireRole("customer");
  const customer = await ownCustomer(profile);

  return <CustomerProfileView profile={profile} customer={customer} />;
}
