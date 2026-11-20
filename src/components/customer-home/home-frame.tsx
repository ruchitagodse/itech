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

// Navigation and frame persist across all Customer screens, keeping visual consistency.
function isTabActive(pathname: string, tabHref: string): boolean {
  if (tabHref === "/customer") {
    return pathname === "/customer";
  }
  if (tabHref === "/customer/appliances") {
    return pathname.startsWith("/customer/appliances") || pathname.startsWith("/customer/service-plans");
  }
  if (tabHref === "/customer/service-requests") {
    return pathname.startsWith("/customer/service-requests") || pathname.startsWith("/customer/service-packages");
  }
  if (tabHref === "/customer/profile") {
    return pathname.startsWith("/customer/profile") || pathname.startsWith("/customer/lifecycle");
  }
  return pathname.startsWith(tabHref);
}

export function CustomerHomeFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!pathname || !pathname.startsWith("/customer")) return <>{children}</>;
  return (
    <div className={styles.homeFrame}>
      {children}
      <nav className={styles.bottomNav} aria-label="Customer home navigation">
        {tabs.map(tab => {
          const active = isTabActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={active ? styles.selectedTab : undefined}
            >
              <HomeIcon name={tab.icon} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
