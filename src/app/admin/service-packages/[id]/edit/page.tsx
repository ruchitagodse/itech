import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getServicePackage } from "@/lib/service-packages/server";
import { PackageForm } from "@/components/service-packages/package-form";
export const metadata = { title: "Edit service package" };
export default async function EditPackagePage({params}:{params:Promise<{id:string}>}) {
  const profile=await requireRole("admin");
  const item=await getServicePackage(profile,(await params).id);
  if(!item)notFound();
  return <><Link className="text-button" href="/admin/service-packages">← Service packages</Link><div className="page-heading customer-heading"><div><h1>Edit package<span className="welcome-dot">.</span></h1><p className="muted">{item.name}</p></div></div><PackageForm item={item} /></>;
}
