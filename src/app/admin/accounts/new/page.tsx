import { requireRole } from "@/lib/auth";
import { CreateAccountForm } from "@/components/create-account-form";
export const metadata = { title: "Create account" };
export default async function CreateAccountPage() {
  await requireRole("admin");
  return <><div className="page-heading"><div><span className="eyebrow">ACCOUNT ACCESS</span><h1>Create an account<span className="welcome-dot">.</span></h1><p className="muted">Give a Technician or Customer access to their iTech workspace.</p></div><span className="pill role-pill">Admin only</span></div>
    <CreateAccountForm />
  </>;
}
