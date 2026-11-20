import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { runInNewContext } from "node:vm";

function load(file, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const testModule = { exports: {} };
  runInNewContext(output, {
    module: testModule,
    exports: testModule.exports,
    require(name) {
      if (!(name in dependencies)) throw Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  });
  return testModule.exports;
}

test("PWA manifest provides standalone config, theme color, shortcuts, and responsive icons", () => {
  const manifestModule = load("src/app/manifest.ts");
  const manifest = manifestModule.default();

  assert.equal(manifest.name, "iTech Care — Home Appliance Services");
  assert.equal(manifest.short_name, "iTech Care");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#07529b");
  assert.equal(manifest.background_color, "#f6f9fc");
  assert.equal(manifest.orientation, "portrait");
  assert.equal(manifest.start_url, "/");

  // Check icons
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4);
  const icon192 = manifest.icons.find(i => i.sizes === "192x192" && i.purpose === "any");
  const maskable192 = manifest.icons.find(i => i.sizes === "192x192" && i.purpose === "maskable");
  const icon512 = manifest.icons.find(i => i.sizes === "512x512" && i.purpose === "any");
  const maskable512 = manifest.icons.find(i => i.sizes === "512x512" && i.purpose === "maskable");

  assert.ok(icon192, "Standard 192x192 icon exists");
  assert.ok(maskable192, "Maskable 192x192 icon exists");
  assert.ok(icon512, "Standard 512x512 icon exists");
  assert.ok(maskable512, "Maskable 512x512 icon exists");

  // Check shortcuts
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 4);
  const appShortcut = manifest.shortcuts.find(s => s.url === "/customer/appliances");
  const reqShortcut = manifest.shortcuts.find(s => s.url === "/customer/service-requests");
  const newShortcut = manifest.shortcuts.find(s => s.url === "/customer/service-requests/new");
  const techShortcut = manifest.shortcuts.find(s => s.url === "/technician/assignments");

  assert.ok(appShortcut, "Customer appliances shortcut exists");
  assert.ok(reqShortcut, "Service requests shortcut exists");
  assert.ok(newShortcut, "New request booking shortcut exists");
  assert.ok(techShortcut, "Technician assignments shortcut exists");
});

test("PWA static assets physically exist in public directory", () => {
  const publicDir = "public";
  const requiredFiles = [
    "icons/icon-192.png",
    "icons/icon-192-maskable.png",
    "icons/icon-512.png",
    "icons/icon-512-maskable.png",
    "icons/apple-touch-icon.png",
    "icons/favicon.png",
    "favicon.ico",
    "splash/apple-splash-portrait.png",
    "sw.js",
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(publicDir, file);
    assert.ok(fs.existsSync(fullPath), `Asset file ${file} must exist`);
    const stats = fs.statSync(fullPath);
    assert.ok(stats.size > 100, `Asset file ${file} must not be empty`);
  }
});

test("PWA Provider renders children seamlessly", () => {
  const dependencies = {
    "react": React,
    "react/jsx-runtime": JsxRuntime,
    "next/image": {
      default: ({ alt, ...props }) => React.createElement("img", { alt, ...props }),
    },
    "./pwa.module.css": { default: new Proxy({}, { get: (_, k) => k }) },
  };

  const { PwaProvider } = load("src/components/pwa/pwa-provider.tsx", dependencies);
  const output = renderToStaticMarkup(
    React.createElement(PwaProvider, null, React.createElement("main", null, "Application Body"))
  );

  assert.match(output, /Application Body/);
});
