import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";

// Pinned official Firestore emulator artifact and checksum from Firebase CLI 15.36.0.
const version = "1.22.0";
const expectedHash = "9b6498b7f62714d67f48f59b3818883cd682dbcd46b9f59511de81c97bb5166c";
const cache = path.resolve(".firebase-emulator-cache");
const jar = path.join(cache, "cloud-firestore-emulator-v" + version + ".jar");
mkdirSync(cache, { recursive: true });
if (!existsSync(jar)) {
  console.log("Downloading the pinned official Firestore emulator. No Firebase credentials are used.");
  const response = await fetch("https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v" + version + ".jar", { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error("Official emulator download failed.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("Emulator checksum mismatch.");
  writeFileSync(jar, bytes);
}
if (createHash("sha256").update(readFileSync(jar)).digest("hex") !== expectedHash) throw new Error("Cached emulator checksum mismatch.");
const env = { ...process.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8187" };
delete env.FIREBASE_TOKEN;
delete env.GOOGLE_APPLICATION_CREDENTIALS;
for (const key of Object.keys(env)) {
  if (key.startsWith("FIREBASE_") || key.startsWith("NEXT_PUBLIC_FIREBASE_")) delete env[key];
}
const log = openSync("firestore-debug.log", "w");
const emulator = spawn("java", ["-jar", jar, "--host", "127.0.0.1", "--port", "8187",
  "--project_id", "demo-itech-v2", "--single_project_mode", "true",
  "--single_project_mode_error", "true", "--rules", "firestore.rules"], { env, stdio: ["ignore", log, log] });
let startupError;
emulator.on("error", error => { startupError = error; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (startupError || emulator.exitCode !== null) throw new Error("Firestore emulator could not start. Java 21+ is required; see firestore-debug.log.");
    try {
      const response = await fetch("http://127.0.0.1:8187/", { signal: AbortSignal.timeout(500) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(500);
  }
  if (!ready) throw new Error("Firestore emulator readiness timed out.");
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--test", "tests/firestore-rules.emulator.mjs"], { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
  process.exitCode = code;
} finally {
  emulator.kill();
  closeSync(log);
}
