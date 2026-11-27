import { requireRole } from "@/lib/auth";
import { customerDirectory } from "@/lib/admin-customers/server";
import { CustomerDirectory } from "@/components/admin-customers/directory";
export const metadata = { title: "Customers" };
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; cursor?: string; filter?: string }> }) {
  const profile = await requireRole("admin"), params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "", cursor = typeof params.cursor === "string" ? params.cursor : "";
  return <CustomerDirectory data={await customerDirectory(profile, query, cursor, typeof params.filter === "string" ? params.filter : "all")} query={query} cursor={cursor}/>;
}
