import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PackageForm } from "@/components/service-packages/package-form";
export const metadata = { title: "Add service package" };
export default async function NewPackagePage() {
  await requireRole("admin");
  return <><Link className="text-button" href="/admin/service-packages">← Service packages</Link><div className="page-heading customer-heading"><div><h1>Add package<span className="welcome-dot">.</span></h1><p className="muted">Define an offering for your Customer catalogue.</p></div></div><PackageForm /></>;
}
