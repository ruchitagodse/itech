"use client";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { usePathname } from "next/navigation";
import { WorkspaceNavigation } from "@/components/ui/workspace-navigation";
import styles from "./home.module.css";

export function CustomerHomeFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!pathname || !pathname.startsWith("/customer")) return <>{children}</>;
  return <div className={styles.homeFrame}>
    {pathname !== "/customer" && <header className={styles.workspaceHeader}><Brand /><Link href="/customer">← Home</Link></header>}
    {children}
    <WorkspaceNavigation role="customer" />
  </div>;
}
