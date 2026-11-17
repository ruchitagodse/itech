import { requireRole } from "@/lib/auth";
import { LifecycleOverview } from "@/components/lifecycle/overview";
export const metadata={title:"Service lifecycle"};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const profile=await requireRole("customer");return <LifecycleOverview profile={profile} search={await searchParams}/>;
}