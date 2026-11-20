import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const tmpProfile = path.join(os.tmpdir(), "edge_cdp_appliances_" + Date.now());
const port = 9336;
const outDir = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e65ccf71-3009-4a84-a662-848c35cdfcdc";

const proc = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${tmpProfile}`,
  "about:blank",
]);

async function waitReady() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("Edge CDP not ready");
}

const resolutions = [
  { name: "mobile_360", w: 360, h: 840, dpr: 2, mobile: true },
  { name: "mobile_375", w: 375, h: 850, dpr: 2, mobile: true },
  { name: "mobile_390", w: 390, h: 880, dpr: 2, mobile: true },
  { name: "mobile_430", w: 430, h: 940, dpr: 2, mobile: true },
  { name: "tablet_768", w: 768, h: 1024, dpr: 1.5, mobile: false },
  { name: "desktop_1280", w: 1280, h: 900, dpr: 1, mobile: false },
];

const pages = [
  { name: "list", url: "file:///c:/Ruchita/Next/itech-v2/scripts/preview-appliances-list.html" },
  { name: "details", url: "file:///c:/Ruchita/Next/itech-v2/scripts/preview-appliances-details.html" },
];

try {
  await waitReady();
  console.log("Edge CDP ready for appliances capture!");

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

      const shot = await send("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(shot.result.data, "base64");
      const targetFile = path.join(outDir, `customer_appliances_${page.name}_${res.name}.png`);
      fs.writeFileSync(targetFile, buffer);
      console.log(`Saved customer_appliances_${page.name}_${res.name}.png (${res.w}x${res.h})`);
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
    const fullTarget = path.join(outDir, `customer_appliances_${page.name}_mobile_360_full.png`);
    fs.writeFileSync(fullTarget, fullBuffer);
    console.log(`Saved full height customer_appliances_${page.name}_mobile_360_full.png (height: ${contentHeight})`);
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
