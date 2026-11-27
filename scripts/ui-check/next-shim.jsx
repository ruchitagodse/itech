import React from "react";
export function usePathname() { return window.__uiPath; }
export function useRouter() { return { push: href => { window.__navigate = href; }, refresh: () => { window.__refreshed = true; }, replace: href => { window.__navigate = href; } }; }
export function redirect(href) { window.__navigate = href; }
export async function currentProfile() { return null; }
export default function Element({ children, href, src, alt, onClick, ...props }) {
  delete props.priority;
  delete props.fill;
  delete props.prefetch;
  // The preview deliberately replaces next/image with an ordinary local image.
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt={alt} {...props} />;
  return <a {...props} href={href} onClick={event => { onClick?.(event); if (!href?.startsWith("#")) { event.preventDefault(); window.__navigate = href; } }}>{children}</a>;
}
