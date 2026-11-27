import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { adminCustomerDetails } from "@/lib/admin-customers/server";
import { AdminCustomerDetails } from "@/components/admin-customers/details";
export const metadata = { title: "Customer details" };
export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const profile = await requireRole("admin"), { id } = await params;
  const data = await adminCustomerDetails(profile, id);
  if (!data) notFound();
  return <AdminCustomerDetails data={data} saved={(await searchParams).saved === "1"}/>;
}
