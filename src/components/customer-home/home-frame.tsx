"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, type HomeIconName } from "./icons";
import styles from "./home.module.css";

const tabs: { href: string; label: string; icon: HomeIconName }[] = [
  { href: "/customer", label: "Home", icon: "home" },
  { href: "/customer/appliances", label: "Appliances", icon: "appliance" },
  { href: "/customer/service-requests", label: "Requests", icon: "request" },
  { href: "/customer/profile", label: "Profile", icon: "profile" },
];

// Only the home route opts into this presentation; other Customer screens keep their existing shell.
export function CustomerHomeFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname !== "/customer") return <>{children}</>;
  return <div className={styles.homeFrame}>{children}<nav className={styles.bottomNav} aria-label="Customer home navigation">{tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined} className={pathname === tab.href ? styles.selectedTab : undefined}><HomeIcon name={tab.icon} /><span>{tab.label}</span></Link>)}</nav></div>;
}
