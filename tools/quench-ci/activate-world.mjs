#!/usr/bin/env node
/**
 * First-boot activation for a felddy Foundry container, in two phases around a
 * caller-driven container restart:
 *   --phase eula   Accept the EULA, generating the host-bound license signature
 *                  (felddy installs the KEY at boot; the signature can't be
 *                  pre-committed). Caller then restarts so felddy's FOUNDRY_WORLD
 *                  auto-launches the world server-side. The signature survives a
 *                  same-container restart, so no re-acceptance.
 *   --phase await  Poll /api/status until the world is active.
 * Server-side auto-launch is used instead of clicking the setup UI, which proved
 * version-fragile (migration dialog, hover-revealed control, telemetry prompt).
 *
 * Usage: node activate-world.mjs --phase eula|await [--url URL] [--wait 240]
 * Exit: 0 = ok, 1 = failed (diagnostics on stderr).
 */
import { chromium } from "playwright";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const URL = arg("url", "http://localhost:30000").replace(/\/$/, "");
const PHASE = arg("phase", "eula");
const WAIT_S = Number(arg("wait", "240"));

async function getStatus() {
  try {
    const res = await fetch(`${URL}/api/status`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function waitForUp(deadlineMs) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    if (await getStatus()) return;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Server at ${URL} did not respond within ${deadlineMs / 1000}s`);
}

async function dumpPageState(page, label) {
  try {
    const state = await page.evaluate(() => ({
      url: location.href,
      view: globalThis.game?.view,
      bodyText: (document.body?.innerText || "").slice(0, 400),
      dialogs: [...document.querySelectorAll("dialog[open], .application.dialog")].map((d) =>
        (d.innerText || "").slice(0, 200),
      ),
      notifications: [...document.querySelectorAll("#notifications li, .notification")].map(
        (n) => (n.innerText || "").slice(0, 150),
      ),
    }));
    console.error(`--- page state (${label}) ---\n${JSON.stringify(state, null, 2)}`);
  } catch (e) {
    console.error(`--- page state (${label}) unavailable: ${e.message}`);
  }
}

async function phaseEula() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    console.error(`Waiting for ${URL} to respond...`);
    await waitForUp(WAIT_S * 1000);

    const status = await getStatus();
    if (status?.active === true) {
      console.error("World already active; EULA evidently signed. Nothing to do.");
      return;
    }

    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const consoleErrors = [];
    page.on("pageerror", (e) => consoleErrors.push(e.message.slice(0, 200)));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`console: ${m.text().slice(0, 200)}`);
    });

    // The agreement form renders client-side; absence after the wait means already signed.
    await page.goto(`${URL}/license`, { waitUntil: "networkidle" });
    const eulaPresent = await page
      .waitForSelector("#eula-agree", { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);

    if (!eulaPresent) {
      // Already signed (redirects to /setup) vs. something else wrong — tell apart by URL.
      if (page.url().includes("/setup") || page.url().includes("/join")) {
        console.error("No EULA form; license already signed.");
        return;
      }
      await dumpPageState(page, "no EULA form");
      throw new Error(`Expected the EULA form or /setup, got ${page.url()}`);
    }

    console.error("Accepting EULA...");
    await page.check("#eula-agree");
    // Wait on the POST specifically; a generic navigation wait races the submit and leaves it unsigned.
    const [resp] = await Promise.all([
      page
        .waitForResponse(
          (r) => r.url().includes("/license") && r.request().method() === "POST",
          { timeout: 20_000 },
        )
        .catch(() => null),
      page.click("#sign"),
    ]);
    if (!resp || resp.status() >= 400) {
      const body = resp ? (await resp.text().catch(() => "")).slice(0, 300) : "";
      await dumpPageState(page, "EULA POST failed");
      throw new Error(
        `EULA POST failed (status ${resp ? resp.status() : "no response"}) ${body}`,
      );
    }
    console.error(`EULA POST -> ${resp.status()} (redirect: ${resp.headers().location ?? "none"})`);
    await page.waitForLoadState("networkidle").catch(() => {});

    if (!page.url().includes("/setup")) {
      await dumpPageState(page, "after EULA sign");
      if (consoleErrors.length) console.error("page errors:", consoleErrors.join("\n"));
      throw new Error(`EULA accepted but did not reach /setup (at ${page.url()})`);
    }
    console.error("License signature created (reached /setup).");
  } finally {
    await browser.close();
  }
}

async function phaseAwait() {
  console.error(`Waiting for the world to become active at ${URL}...`);
  const deadline = Date.now() + WAIT_S * 1000;
  let last = null;
  while (Date.now() < deadline) {
    last = await getStatus();
    if (last?.active === true) {
      console.error(
        `World active: ${last.world} (system ${last.system} ${last.systemVersion ?? ""}).`,
      );
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(
    `World did not become active within ${WAIT_S}s (last status: ${JSON.stringify(last)})`,
  );
}

try {
  if (PHASE === "eula") await phaseEula();
  else if (PHASE === "await") await phaseAwait();
  else throw new Error(`Unknown --phase "${PHASE}" (expected "eula" or "await")`);
  process.exitCode = 0;
} catch (err) {
  console.error(`Activation error (phase ${PHASE}): ${err.message}`);
  process.exitCode = 1;
}
