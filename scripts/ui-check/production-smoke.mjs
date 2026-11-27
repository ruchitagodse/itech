import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

/** Checks the built Next application in a fresh browser, with no authenticated session. */
export async function productionSmoke({ cdp, evaluate, report }) {
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, APP_ORIGIN: origin };
  // Blank values override .env.local, preventing server-side live Firebase access.
  for (const name of Object.keys(env)) if (name.startsWith("FIREBASE_") || name.startsWith("NEXT_PUBLIC_FIREBASE_")) env[name] = "";
  for (const name of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_APP_ID"]) env[name] = "";
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { env, stdio: "ignore", windowsHide: true });
  try {
    let ready = false;
    for (let n = 0; n < 80; n++) {
      if (server.exitCode !== null) throw new Error("Isolated production server exited early. Run npm run build first.");
      try { if ((await fetch(origin + "/login")).ok) { ready = true; break; } } catch {}
      await delay(100);
    }
    assert(ready, "Production server startup timed out");
    // Built client configuration may contain public Firebase settings. Block external traffic.
    await cdp("Network.enable");
    await cdp("Network.setBlockedURLs", { urls: ["https://*", "http://*.googleapis.com/*"] });
    let navigation = 0;
    async function page(route) {
      const previousDocument = String(++navigation);
      await evaluate(`window.__productionDocument = ${JSON.stringify(previousDocument)}`);
      await cdp("Page.navigate", { url: origin + route });
      for (let n = 0; n < 100; n++) {
        try {
          if (await evaluate(`window.__productionDocument !== ${JSON.stringify(previousDocument)} && location.pathname === '/login' && !!document.querySelector('#email') && !!document.querySelector('#password')`)) return;
        } catch { /* A document navigation can briefly replace the execution context. */ }
        await delay(50);
      }
      throw new Error(`Production route ${route} did not reach the sign-in page`);
    }
    for (const width of [360, 768, 1440]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      await page("/login");
      // Wait for hydration by retrying an observable React-controlled interaction.
      let hydrated = false;
      for (let n = 0; n < 60; n++) {
        await evaluate("document.querySelector('[aria-label=\"Show password\"]')?.click()");
        await delay(40);
        if (await evaluate("document.getElementById('password').type === 'text'")) { hydrated = true; break; }
      }
      assert(hydrated, "Built login did not hydrate");
      assert(await evaluate("document.documentElement.scrollWidth <= innerWidth && parseFloat(getComputedStyle(document.getElementById('email')).fontSize) >= 16"));
      assert(await evaluate("!document.querySelector('meta[name=viewport]').content.includes('user-scalable=no')"));
      report.interactions.push({ name: "Built Next login: hydration, responsive layout, password visibility and zoom", width, passed: true });
      for (const route of ["/admin", "/admin/customers", "/admin/service-requests", "/technician/assignments", "/customer/appliances", "/customer/lifecycle"]) {
        await page(route);
        report.interactions.push({ name: `Built route ${route}: anonymous access returns to login`, width, passed: true });
      }
    }
  } finally {
    server.kill();
    await cdp("Network.setBlockedURLs", { urls: [] });
  }
}
