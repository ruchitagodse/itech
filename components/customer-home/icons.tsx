export type HomeIconName = "home" | "appliance" | "request" | "profile" | "bell" | "arrow" | "plus" | "calendar" | "shield" | "water" | "ac" | "check" | "clock" | "wrench";
export function HomeIcon({ name, className, style }: { name: HomeIconName; className?: string; style?: React.CSSProperties }) {
  const paths: Record<HomeIconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
    appliance: <><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M5 10h14M9 6h.01M9 14v3" /></>,
    request: <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 22v-2a8 8 0 0 1 16 0v2" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 2v6m10-6v6M3 11h18m-13 5h2m4 0h2" /></>,
    shield: <><path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5Z" /><path d="m8 12 3 3 5-6" /></>,
    water: <><path d="M12 2C10 6 5 11 5 15a7 7 0 0 0 14 0c0-4-5-9-7-13Z" /><path d="M9 15a3 3 0 0 0 3 3" /></>,
    ac: <><rect x="2" y="4" width="20" height="10" rx="3" /><path d="M5 10h14M7 18v3m5-4v5m5-4v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  };
  return <svg className={className} style={style} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
