import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const tmpProfile = path.join(os.tmpdir(), "edge_cdp_admin_appliances_" + Date.now());
const port = 9338;
const outDir = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e65ccf71-3009-4a84-a662-848c35cdfcdc";

const proc = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${tmpProfile}`,
  "about:blank",
]);

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("Edge CDP not ready");
}

const resolutions = [
  { name: "360", w: 360, h: 800, dpr: 2, mobile: true },
  { name: "375", w: 375, h: 812, dpr: 2, mobile: true },
  { name: "390", w: 390, h: 844, dpr: 3, mobile: true },
  { name: "430", w: 430, h: 932, dpr: 3, mobile: true },
  { name: "768", w: 768, h: 1024, dpr: 2, mobile: false },
  { name: "1024", w: 1024, h: 768, dpr: 1, mobile: false },
  { name: "1280", w: 1280, h: 900, dpr: 1, mobile: false },
  { name: "1440", w: 1440, h: 900, dpr: 1, mobile: false },
];

const pages = [
  { name: "list", url: "file:///c:/Ruchita/Next/itech-v2/scripts/preview-admin-appliances-list.html" },
  { name: "details", url: "file:///c:/Ruchita/Next/itech-v2/scripts/preview-admin-appliances-details.html" },
];

try {
  await waitReady();
  console.log("Edge CDP ready for admin appliances capture!");

  const newPageRes = await fetch(`http://127.0.0.1:${port}/json/new`, { method: "PUT" });
  const target = await newPageRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();

  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  await new Promise(r => (ws.onopen = r));

  function send(method, params = {}) {
    return new Promise(resolve => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send("Page.enable");
  await send("DOM.enable");

  for (const page of pages) {
    await send("Page.navigate", { url: page.url });
    await new Promise(r => setTimeout(r, 600));

    for (const res of resolutions) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: res.w,
        height: res.h,
        deviceScaleFactor: res.dpr,
        mobile: res.mobile,
      });
      await new Promise(r => setTimeout(r, 200));

      // Check horizontal overflow
      const overflowCheck = await send("Runtime.evaluate", {
        expression: "document.documentElement.scrollWidth > window.innerWidth",
      });
      const hasOverflow = overflowCheck.result?.value;
      if (hasOverflow) {
        console.warn(`WARNING: Overflow detected on ${page.name} at ${res.w}px!`);
      } else {
        console.log(`PASS: No overflow on ${page.name} at ${res.w}px.`);
      }

      const shot = await send("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(shot.result.data, "base64");
      const targetFile = path.join(outDir, `admin_appliances_${page.name}_${res.name}.png`);
      fs.writeFileSync(targetFile, buffer);
      console.log(`Saved admin_appliances_${page.name}_${res.name}.png (${res.w}x${res.h})`);
    }

    // Capture full height for mobile_360
    await send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 200));
    const metrics = await send("Page.getLayoutMetrics");
    const contentHeight = Math.ceil(metrics.result.contentSize.height);

    await send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: contentHeight,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 200));

    const fullShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    const fullBuffer = Buffer.from(fullShot.result.data, "base64");
    const fullTarget = path.join(outDir, `admin_appliances_${page.name}_360_full.png`);
    fs.writeFileSync(fullTarget, fullBuffer);
    console.log(`Saved full height admin_appliances_${page.name}_360_full.png (height: ${contentHeight})`);
  }

  ws.close();
} catch (e) {
  console.error("Capture error:", e);
} finally {
  proc.kill();
  try {
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  } catch {}
}
