import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

/** Exercises real React handlers. Only navigation and server responses are stubbed. */
export async function runInteractions({ cdp, evaluate, visit, report }) {
  async function field(id, value) {
    await evaluate(`(() => {
      const el = document.getElementById(${JSON.stringify(id)});
      if (!el) throw Error('Missing field: ' + ${JSON.stringify(id)});
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true}));
    })()`);
    await delay(30);
  }
  async function click(label) {
    await evaluate(`(() => {
      const el = [...document.querySelectorAll('main button')].find(el => el.textContent.trim() === ${JSON.stringify(label)});
      if (!el || el.disabled) throw Error('Missing/disabled action: ' + ${JSON.stringify(label)});
      el.click();
    })()`);
    await delay(40);
  }
  const lastRequest = () => evaluate("window.__requests.at(-1)");
  const mainText = () => evaluate("document.querySelector('main').textContent");
  const submit = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector || "main form")}).closest("form").requestSubmit()`); await delay(40); };
  async function tap(selector) {
    const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const r = el.getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 }; })()`);
    await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await delay(80);
  }
  for (const width of [360, 768, 1440]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await cdp("Emulation.setTouchEmulationEnabled", { enabled: width < 1100 });
    async function check(name, test) {
      try { await test(); report.interactions.push({ name, width, passed: true }); }
      catch (error) { report.failures.push({ interaction: name, width, error: error.message }); }
    }
    for (const role of ["admin", "technician", "customer"]) {
      if (width < 1100) await check(`${role} menu: touch, search, role links, focus trap, Escape, link dismissal`, async () => {
        await visit(role === "customer" ? "customer-home" : role + "-overview");
        await tap('nav[aria-label="' + (role === "customer" ? "Customer home navigation" : role + " quick navigation") + '"] button');
        assert(await evaluate("!!document.querySelector('dialog[open]')"));
        await evaluate("document.querySelector('dialog input').id = 'menu-search'");
        await field("menu-search", "zz-no-result");
        assert.match(await evaluate("document.querySelector('dialog').textContent"), /No matching screens/);
        await field("menu-search", "");
        const links = await evaluate("[...document.querySelectorAll('dialog nav a')].map(a => a.getAttribute('href'))");
        assert(links.length >= 2 && links.every(href => href.startsWith("/" + role)));
        // Native dialog focus must not escape into the page while tabbing.
        for (let n = 0; n < links.length + 4; n++) {
          await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
          await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
          assert(await evaluate("document.activeElement === document.body || document.activeElement.closest('dialog') !== null"));
        }
        await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await delay(50);
        assert(await evaluate("!document.querySelector('dialog').open && document.activeElement.textContent.trim() === 'More'"));
        await evaluate("document.activeElement.click()");
        await delay(40);
        await evaluate("document.querySelector('dialog nav a').click()");
        await delay(40);
        assert.equal(await evaluate("window.__navigate"), "/" + role);
        assert(await evaluate("!document.querySelector('dialog').open"));
      });
      await check(`${role} sign-out error retains session UI and permits retry`, async () => {
        await visit(role === "customer" ? "customer-home" : role + "-overview");
        if (width < 1100) {
          await evaluate("[...document.querySelectorAll('nav button')].find(el => el.textContent.trim() === 'More').click()");
          await delay(40);
        }
        await evaluate(`window.__responseOK = false; document.querySelector(${JSON.stringify(width < 1100 ? "dialog .logout-button" : ".logout-button")}).click()`);
        await delay(40);
        assert.equal((await lastRequest()).url, "/api/session");
        assert.match(await evaluate("document.body.textContent"), /Could not sign out/);
        assert(await evaluate(`!document.querySelector(${JSON.stringify(width < 1100 ? "dialog .logout-button" : ".logout-button")}).disabled`));
      });
    }
    if (width >= 1100) await check("Desktop sidebar collapse/expand preserves sign-out", async () => {
      await visit("admin-overview");
      await evaluate("document.querySelector('[aria-label=\"Collapse sidebar\"]').click()");
      await delay(40);
      assert(await evaluate("document.querySelector('[aria-label=\"Expand sidebar\"]') !== null && document.querySelector('.logout-button').getBoundingClientRect().height >= 44"));
      await evaluate("document.querySelector('[aria-label=\"Expand sidebar\"]').click()");
      await delay(40);
      assert(await evaluate("document.querySelector('[aria-label=\"Collapse sidebar\"]') !== null"));
    });
    if (width < 1100) await check("Menu closes on route changes and restores visible focus after resizing", async () => {
      await visit("admin-overview");
      await evaluate("document.querySelector('[aria-label=\"Open navigation\"]').click()");
      await delay(40);
      await evaluate("document.querySelector('dialog input').id = 'menu-search'; window.__uiPath = '/admin/customers'");
      await field("menu-search", "Customers");
      assert(await evaluate("!document.querySelector('dialog').open"));
      await evaluate("document.querySelector('[aria-label=\"Open navigation\"]').click()");
      await delay(40);
      await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await delay(50);
      assert.equal(await evaluate("document.activeElement.id"), "main");
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    });
    await check("Technician notes: required validation, save, completion and failure recovery", async () => {
      await visit("technician-work");
      await click("Complete work");
      assert.match(await mainText(), /Add service notes/);
      assert.equal(await evaluate("window.__requests.length"), 0);
      await field("service-notes", "Filter inspected and cleaned.");
      await click("Save notes");
      assert.equal((await lastRequest()).body.action, "save_notes");
      assert.match(await mainText(), /Work updated/);
      await evaluate("window.__responseOK = false");
      await click("Complete work");
      assert.equal((await lastRequest()).body.action, "complete");
      assert.match(await mainText(), /Fixture request failed/);
      assert.equal(await evaluate("document.getElementById('service-notes').value"), "Filter inspected and cleaned.");
      await evaluate("window.__responseOK = true");
      await click("Complete work");
      assert.match(await mainText(), /Work updated/);
    });
    await check("Customer request: invalid submission, error preserves input, successful retry", async () => {
      await visit("customer-request-new");
      await submit();
      assert.equal(await evaluate("window.__requests.length"), 0);
      await field("request-description", "Please inspect the purifier and replace its filter.");
      await evaluate("window.__responseOK = false");
      await submit();
      assert.match(await mainText(), /Fixture request failed/);
      assert.match(await evaluate("document.getElementById('request-description').value"), /inspect the purifier/);
      await evaluate("window.__responseOK = true");
      await submit();
      assert.equal((await lastRequest()).url, "/api/service-requests");
      assert.equal((await lastRequest()).body.applianceId, "appliance-1");
      assert.equal(await evaluate("window.__navigate"), "/customer/service-requests/fixture-saved?saved=1");
    });
    await check("Customer request filters and pagination destination", async () => {
      await visit("customer-requests");
      await click("Completed (1)");
      assert.equal(await evaluate("document.querySelectorAll('main [class$=\"_requestCard\"]').length"), 1);
      assert.match(await evaluate("document.querySelector('main [role=tab][aria-selected=true]').textContent"), /Completed/);
      const href = await evaluate("[...document.querySelectorAll('main a')].find(a => a.textContent.includes('Next')).getAttribute('href')");
      assert.match(href, /cursor=next/);
    });
    await check("Package editing preserves version and validates required fields", async () => {
      await visit("admin-package-new");
      await submit();
      assert.equal(await evaluate("window.__requests.length"), 0);
      assert(await evaluate("!!document.querySelector('main [aria-invalid=true]')"));
      await visit("admin-package-edit");
      await field("package-price", "2999.00");
      await submit();
      assert.equal((await lastRequest()).url, "/api/service-packages/package-1");
      assert.equal((await lastRequest()).body.expectedVersion, 1);
      assert.equal(await evaluate("window.__navigate"), "/admin/service-packages?saved=1");
    });
    await check("Customer edit saves existing identity and service address", async () => {
      await visit("admin-customer-edit");
      await field("customer-address", "Apartment 1204, Lakeview Residency, Pune");
      await field("customer-pincode", "411001");
      await submit();
      assert.equal((await lastRequest()).url, "/api/customers/customer-1");
      assert.equal((await lastRequest()).body.fullName, "Asha Sharma");
    });
    await check("Appliance edit retains customer and appliance endpoint", async () => {
      await visit("admin-appliance-edit");
      await field("appliance-notes", "Updated access instructions for the technician.");
      await submit();
      assert.equal((await lastRequest()).url, "/api/customers/customer-1/appliances/appliance-1");
      assert.match((await lastRequest()).body.notes, /Updated access/);
    });
    await check("Technician provisioning keeps fixed role and recovery instructions", async () => {
      await visit("admin-technician-new");
      await field("technician-name", "Fixture Technician");
      await field("technician-email", "technician@example.test");
      await submit();
      assert.equal((await lastRequest()).body.role, "technician");
      assert.match(await mainText(), /Technician account created/);
      assert.match(await mainText(), /Forgot password/);
    });
    await check("Admin status completion retains notes and expected status", async () => {
      await visit("admin-request-detail");
      await field("request-status", "completed");
      await field("admin-completion-notes", "Completed filter replacement and performance check.");
      await submit("#request-status");
      assert.equal((await lastRequest()).body.status, "completed");
      assert.equal((await lastRequest()).body.expectedStatus, "in_progress");
      assert.match((await lastRequest()).body.notes, /filter replacement/);
      assert.match(await mainText(), /Status updated/);
    });
    await check("Plan creation requires configured package and locks derived dates", async () => {
      await visit("admin-plan-new");
      assert(await evaluate("document.querySelector('main button[type=submit]').disabled"));
      await click("Load maintenance packages");
      await field("source-package", "package-1");
      assert.equal(await evaluate("document.getElementById('plan-expiry').value"), "2027-01-05");
      assert(await evaluate("document.getElementById('plan-start').disabled && document.getElementById('plan-expiry').disabled"));
      await submit();
      assert.equal((await lastRequest()).url, "/api/customers/customer-1/appliances/appliance-1/service-plans");
      assert.equal((await lastRequest()).body.packageId, "package-1");
    });
    await check("Customer consent saves explicit preference", async () => {
      await visit("customer-lifecycle-maintenanceSchedule");
      await field("wa-phone", "+919876543210");
      await evaluate("document.querySelector('main input[type=checkbox]').click()");
      await delay(30);
      await submit();
      assert.equal((await lastRequest()).url, "/api/lifecycle");
      assert.equal((await lastRequest()).body.enabled, true);
    });
    await check("Login password visibility and recovery navigation", async () => {
      await visit("login");
      await field("email", "customer@example.test");
      await field("password", "fixture-password");
      await click("Show");
      assert.equal(await evaluate("document.getElementById('password').type"), "text");
      await click("Hide");
      assert.equal(await evaluate("document.getElementById('password').type"), "password");
      await click("Forgot password?");
      assert.equal(await evaluate("document.getElementById('password')"), null);
      assert.match(await mainText(), /password reset link/);
      await evaluate("[...document.querySelectorAll('main button')].find(b => b.textContent.includes('Back to sign in')).click()");
      await delay(40);
      assert.equal(await evaluate("document.getElementById('email').value"), "customer@example.test");
      assert.equal(await evaluate("document.getElementById('password').type"), "password");
    });
    await check("Pending assignment saves technician without changing status", async () => {
      await visit("admin-request-pending");
      await field("assigned-technician", "fixture-technician");
      await click("Save assignment");
      assert.equal((await lastRequest()).url, "/api/service-requests/request-2/assignment");
      assert.equal((await lastRequest()).body.technicianUid, "fixture-technician");
      assert.equal((await lastRequest()).body.status, undefined);
      assert.match(await mainText(), /Assignment saved/);
    });
    await check("Technician starts pending work", async () => {
      await visit("technician-start-work");
      await click("Start work");
      assert.equal((await lastRequest()).body.action, "start");
      assert.equal((await lastRequest()).body.expectedStatus, "pending");
      assert.match(await mainText(), /Work updated/);
    });
    await check("Customer renewal agreement and decline retain version guards", async () => {
      await visit("customer-lifecycle-renewals");
      assert.equal(await evaluate("[...document.querySelectorAll('main button')].some(b => b.textContent.includes('Confirm renewal'))"), false);
      await evaluate("[...document.querySelectorAll('main button')].find(b => b.textContent.includes('Agree to renewal')).click()");
      await delay(40);
      assert.equal((await lastRequest()).body.action, "agree");
      assert.equal((await lastRequest()).body.expectedVersion, 1);
      assert.match(await mainText(), /admin team will confirm/);
      await visit("customer-lifecycle-renewals");
      await click("Decline");
      assert.equal((await lastRequest()).body.action, "decline");
      assert.match(await mainText(), /proposal declined/);
    });
    await check("Admin renewal confirmation remains separate from customer agreement", async () => {
      await visit("admin-lifecycle-renewals");
      assert.equal(await evaluate("[...document.querySelectorAll('main button')].some(b => b.textContent.includes('Agree to renewal'))"), false);
      await click("Confirm renewal");
      assert.equal((await lastRequest()).body.action, "confirm");
      assert.equal((await lastRequest()).body.id, "renewal-2");
      assert.equal((await lastRequest()).body.expectedVersion, 1);
    });
    await check("Catalogue filters, empty result and reset", async () => {
      await visit("customer-packages");
      await evaluate("[...document.querySelectorAll('main button')].find(b => b.textContent.includes('Air Conditioners')).click()");
      await delay(40);
      assert.equal(await evaluate("document.querySelectorAll('main [class$=\"_packageCard\"]').length"), 0);
      await evaluate("[...document.querySelectorAll('main button')].find(b => b.className.includes('clearFilter')).click()");
      await delay(40);
      assert.equal(await evaluate("document.querySelectorAll('main [class$=\"_packageCard\"]').length"), 1);
    });
    if (width === 360) await check("Landscape drawer scrolling, background lock and reduced motion", async () => {
      await cdp("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
      await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      await visit("customer-home");
      await evaluate("[...document.querySelectorAll('nav button')].find(el => el.textContent.trim() === 'More').click()");
      await delay(40);
      assert.equal(await evaluate("getComputedStyle(document.body).overflow"), "hidden");
      assert(await evaluate("parseFloat(getComputedStyle(document.querySelector('dialog')).animationDuration) <= 0.001"));
      const result = await evaluate(`(() => {
        const scroller = document.querySelector('dialog > div'); scroller.scrollTop = scroller.scrollHeight;
        const r = document.querySelector('dialog .logout-button').getBoundingClientRect();
        return { top:r.top, bottom:r.bottom, overflow:document.documentElement.scrollWidth > innerWidth };
      })()`);
      assert(result.top >= 0 && result.bottom <= 390 && !result.overflow);
      await cdp("Emulation.setEmulatedMedia", { features: [] });
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: true });
    });
    console.log(`Interaction pass at ${width}px finished; ${report.failures.length} total issues.`);
  }
}
