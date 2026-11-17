import "server-only";
export function sameOrigin(request: Request): boolean {
  const configured = process.env.APP_ORIGIN;
  if (!configured) return false;
  try { return new URL(configured).origin === request.headers.get("origin"); }
  catch { return false; }
}
