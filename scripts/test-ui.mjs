import { createRequire } from "node:module";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { runInteractions } from "./ui-check/interactions.mjs";
import { productionSmoke } from "./ui-check/production-smoke.mjs";

const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = process.cwd(), out = path.join(root, ".ui-check");
await mkdir(path.join(out, "screens"), { recursive: true });
const shim = path.join(root, "scripts/ui-check/next-shim.jsx");
await new Promise((resolve, reject) => webpack({
  mode: "development", devtool: false, target: "web",
  entry: path.join(root, "scripts/ui-check/preview.jsx"),
  output: { path: out, filename: "preview.js" },
  resolve: { extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs"], alias: {
    "@/lib/auth$": shim, "next/link$": shim, "next/image$": shim, "next/navigation$": shim,
    "@/lib/lifecycle/server$": path.join(root, "scripts/ui-check/server-shim.mjs"),
    "@/lib/service-packages/server$": path.join(root, "scripts/ui-check/server-shim.mjs"),
    "@/lib/service-plans/server$": path.join(root, "scripts/ui-check/server-shim.mjs"),
    "@/lib/firebase/client$": path.join(root, "scripts/ui-check/client-shim.mjs"),
    "@": path.join(root, "src"),
  } },
  module: { rules: [{ test: /\.(tsx?|jsx|css|scss)$/, exclude: /node_modules/, use: path.join(root, "scripts/ui-check/loader.mjs") }] },
}, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(new Error(stats.toString({ all: false, errors: true }))) : resolve()));

const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated iTech UI checks</title></head><body><div id="root"></div><script src="/preview.js"></script></body></html>';
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/preview.js") { res.setHeader("Content-Type", "application/javascript"); res.end(await readFile(path.join(out, "preview.js"))); }
    else if (url.pathname.startsWith("/itech-logo") || url.pathname.startsWith("/icons/")) { res.setHeader("Content-Type", url.pathname.endsWith(".jpeg") ? "image/jpeg" : "image/png"); res.end(await readFile(path.join(root, "public", url.pathname))); }
    else { res.setHeader("Content-Type", "text/html"); res.end(html); }
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const executable = process.env.UI_BROWSER || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
if (!executable) throw new Error("Set UI_BROWSER to a Chromium executable.");
const chrome = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${path.join(out, "browser-profile")}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
let ws;
const report = { scope: "Synthetic presentation components; Next navigation and API responses are isolated shims. No live Firebase data.", checks: [], interactions: [], failures: [] };
try {
  const endpoint = await new Promise((resolve, reject) => {
    let text = "";
    const timeout = setTimeout(() => reject(new Error("Browser startup timed out")), 20000);
    chrome.once("error", error => { clearTimeout(timeout); reject(error); });
    chrome.stderr.on("data", chunk => { text += chunk; const found = text.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (found) { clearTimeout(timeout); resolve(found[1]); } });
  });
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); if (message.error) reject(new Error(message.error.message)); else resolve(message.result); } });
  function send(method, params = {}, sessionId) { return new Promise((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  await cdp("Page.enable");
  async function evaluate(expression) {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " " + result.exceptionDetails.exception?.description);
    return result.result.value;
  }
  async function visit(screen) {
    await evaluate("window.__ready = false");
    await cdp("Page.navigate", { url: origin + "/?screen=" + encodeURIComponent(screen) });
    for (let n = 0; n < 120; n++) {
      try { if (await evaluate("window.__ready === true")) break; }
      catch { /* The browser replaces execution contexts during navigation. */ }
      await delay(50);
    }
    assert.equal(await evaluate("window.__ready"), true, `Timed out rendering ${screen}`);
    const error = await evaluate("window.__uiError");
    assert.equal(error, null, `${screen}: ${error}`);
  }
  await visit("admin-overview");
  const screens = await evaluate("window.__uiScreens");
  const widths = [320, 360, 768, 1024, 1440];
  for (const width of widths) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const screen of screens) {
      try {
        await visit(screen.name);
        const result = await evaluate(`(() => {
          const visible = el => !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
          const nav = [...document.querySelectorAll('nav[aria-label$="quick navigation"], nav[aria-label="Customer home navigation"]')].find(visible);
          const controls = [...document.querySelectorAll('main button, main input:not([type=checkbox]):not([type=radio]), main select, main textarea')].filter(visible);
          return { navBottom: nav?.getBoundingClientRect().bottom, overflow: document.documentElement.scrollWidth > innerWidth + 1,
            smallFields: controls.filter(el => /INPUT|SELECT|TEXTAREA/.test(el.tagName) && parseFloat(getComputedStyle(el).fontSize) < 16).map(el => el.id),
            shortControls: controls.filter(el => el.getBoundingClientRect().height < 43).map(el => el.textContent.trim().slice(0,60) || el.id),
            navVisible: [...document.querySelectorAll('nav[aria-label$="quick navigation"], nav[aria-label="Customer home navigation"]')].some(visible),
            offenders: [...document.querySelectorAll('main *')].filter(visible).filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,5).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })) };
        })()`);
        assert.equal(result.overflow, false, `Horizontal overflow: ${JSON.stringify(result.offenders)}`);
        assert.deepEqual(result.smallFields, [], "Input text below 16px");
        assert.deepEqual(result.shortControls, [], "Controls below 44px");
        assert.equal(result.navVisible, width < 1100 && screen.name !== "login", "Navigation breakpoint");
        if (width < 1100 && screen.name !== "login") assert(Math.abs(result.navBottom - 900) <= 1, "Bottom navigation must stay at the viewport bottom");
        report.checks.push({ screen: screen.name, width, passed: true });
        if ([360, 768, 1440].includes(width) && ["login", "admin-overview", "customer-home", "technician-overview", "admin-appliance-new", "customer-request-new", "customer-profile"].includes(screen.name)) {
          const screenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
          await writeFile(path.join(out, "screens", `${screen.name}-${width}.png`), Buffer.from(screenshot.data, "base64"));
        }
      } catch (error) { report.failures.push({ screen: screen.name, width, error: error.message }); }
    }
    console.log(`Checked ${screens.length} screens at ${width}px; ${report.failures.length} issues so far.`);
  }
  await runInteractions({ cdp, evaluate, visit, report });
  await productionSmoke({ cdp, evaluate, report });
} finally {
  if (ws?.readyState === WebSocket.OPEN) ws.close();
  chrome.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(`${report.checks.length} responsive checks and ${report.interactions.length} interaction groups passed.`);
if (report.failures.length) { console.error(JSON.stringify(report.failures, null, 2)); process.exitCode = 1; }
