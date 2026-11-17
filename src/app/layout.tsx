import type { Metadata } from "next";
import "./globals.scss";
export const metadata: Metadata = { title: { default: "iTech V2 | Service, simplified.", template: "%s | iTech V2" }, description: "Your workspace for water purifier and air conditioning care.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>;
}
