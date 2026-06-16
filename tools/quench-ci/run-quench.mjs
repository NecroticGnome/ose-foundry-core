#!/usr/bin/env node
// Runs the OSE Quench batches against a Foundry server via headless Playwright,
// emits a JSON report, exits nonzero on failure. Args/README in tools/quench-ci.
// Exit: 0 = passed, 1 = failures, 2 = harness error.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const FILTER = arg("filter", "**");
const URL = arg("url", "http://localhost:30000").replace(/\/$/, "");
const USER = arg("user", "Gamemaster");
const PASSWORD = arg("password", "");
const ENABLE_MODULE = arg("enable-module", ""); // "" = assume already enabled
const HEADED = process.argv.includes("--headed");
const TIMEOUT_S = Number(arg("timeout", "300"));
// 2-core CI runs Foundry ops ~10x slower than a dev box; mocha's 2s default mass-fails.
const MOCHA_TIMEOUT_MS = Number(arg("mocha-timeout", "2000"));
const SERVER_WAIT_S = Number(arg("server-wait", "240"));
const REPO = arg("repo", process.cwd());

function gitInfo() {
  try {
    const branch =
      process.env.GITHUB_REF_NAME ||
      execSync("git branch --show-current", { cwd: REPO }).toString().trim();
    const sha =
      (process.env.GITHUB_SHA && process.env.GITHUB_SHA.slice(0, 7)) ||
      execSync("git rev-parse --short HEAD", { cwd: REPO }).toString().trim();
    const dirty =
      execSync("git status --porcelain", { cwd: REPO }).toString().trim() !== "";
    return { branch, sha, dirty };
  } catch {
    return {
      branch: process.env.GITHUB_REF_NAME || "unknown",
      sha: process.env.GITHUB_SHA || "unknown",
      dirty: false,
    };
  }
}

const git = gitInfo();
const OUT = arg("out", join(HERE, "reports", "quench.json"));

// /api/status is the authoritative readiness signal; the join-page DOM populates
// client-side after the socket connects and is flakier.
async function waitForServer(page, deadlineMs) {
  const start = Date.now();
  let lastErr = "unknown";
  while (Date.now() - start < deadlineMs) {
    try {
      const res = await page.request.get(`${URL}/api/status`, { timeout: 10_000 });
      if (res.ok()) {
        const status = await res.json().catch(() => ({}));
        if (status.active === true) return status;
        lastErr = `world not active yet (active=${status.active})`;
      } else {
        lastErr = `status ${res.status()}`;
      }
    } catch (e) {
      lastErr = e.message.split("\n")[0];
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Server at ${URL} not ready after ${deadlineMs / 1000}s (last: ${lastErr})`);
}

async function joinWorld(page) {
  await page.goto(`${URL}/join`, { waitUntil: "domcontentloaded" });
  const userSelect = page.locator('select[name="userid"]');
  await userSelect.waitFor({ timeout: 30_000 });
  // Options for already-connected users are disabled client-side only; re-enable before selecting.
  await page.evaluate(() => {
    for (const o of document.querySelectorAll('select[name="userid"] option')) o.disabled = false;
  });
  await userSelect.selectOption({ label: USER });
  if (PASSWORD) await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[name="join"]');
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 120_000 });
}

const browser = await chromium.launch({
  headless: !HEADED,
  args: ["--enable-unsafe-swiftshader"], // software WebGL so the headless canvas boots
});

let timeoutId;
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errCounts = {};
  page.on("pageerror", (e) => {
    const k = e.message.slice(0, 80);
    errCounts[k] = (errCounts[k] || 0) + 1;
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      const k = `console:${m.text().slice(0, 80)}`;
      errCounts[k] = (errCounts[k] || 0) + 1;
    }
  });

  console.error(`Waiting for ${URL} to answer with an active world...`);
  await waitForServer(page, SERVER_WAIT_S * 1000);

  console.error(`Joining as ${USER} (repo @ ${git.branch} ${git.sha}${git.dirty ? ", dirty" : ""})...`);
  await joinWorld(page);

  // Enable a module at runtime + reload, so the world fixture needs no committed module config.
  if (
    ENABLE_MODULE &&
    !(await page.evaluate((m) => !!globalThis.game?.modules?.get(m)?.active, ENABLE_MODULE))
  ) {
    console.error(`Module "${ENABLE_MODULE}" not active; enabling and reloading...`);
    await page.evaluate(async (mod) => {
      const cfg = foundry.utils.deepClone(game.settings.get("core", "moduleConfiguration") || {});
      cfg[mod] = true;
      await game.settings.set("core", "moduleConfiguration", cfg);
    }, ENABLE_MODULE);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 120_000 });
  }

  console.error("Waiting for quench...");
  await page.waitForFunction(() => !!globalThis.quench, null, { timeout: 60_000 });

  // --filter is one or more space-separated globs; expand to explicit batch keys
  // (multi-glob is ours, and Quench silently runs nothing on a zero-match filter).
  const matchedKeys = await page.evaluate((filterSpec) => {
    const keys = Array.from(quench._testBatches.keys());
    const regexes = filterSpec
      .split(/\s+/)
      .filter(Boolean)
      .map((glob) => {
        const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`^${esc.replace(/\*\*/g, " ").replace(/\*/g, "[^.]*").replace(/ /g, ".*")}$`);
      });
    return keys.filter((k) => regexes.some((re) => re.test(k)));
  }, FILTER);
  if (matchedKeys.length === 0)
    throw new Error(`Filter "${FILTER}" matches no registered quench batches`);

  console.error(`Running ${matchedKeys.length} quench batch(es) (filter: ${FILTER})...`);
  const data = await Promise.race([
    page.evaluate(async ({ filter, mochaTimeout }) => {
      const q = globalThis.quench;
      await q.app.render(true); // QuenchReporter throws at run-start without the results window
      await new Promise((r) => setTimeout(r, 1500));
      // Raise the per-test timeout on the root suite, then on anything still at the 2s default.
      if (q.mocha?.suite && mochaTimeout > 2000) q.mocha.suite.timeout(mochaTimeout);
      const runner = await q.runBatches(filter); // returns a mocha Runner synchronously
      if (mochaTimeout > 2000) {
        const bump = (suite) => {
          if (suite.timeout() < mochaTimeout) suite.timeout(mochaTimeout);
          for (const t of suite.tests) if (t.timeout() < mochaTimeout) t.timeout(mochaTimeout);
          for (const h of ["_beforeAll", "_afterAll", "_beforeEach", "_afterEach"])
            for (const hook of suite[h] ?? []) if (hook.timeout() < mochaTimeout) hook.timeout(mochaTimeout);
          suite.suites.forEach(bump);
        };
        bump(runner.suite);
      }
      // Collect from Runner events; the quenchReports hook doesn't fire in 0.10.0.
      const C = Mocha.Runner.constants;
      const results = [];
      runner.on(C.EVENT_TEST_PASS, (t) => results.push({ title: t.fullTitle(), state: "passed" }));
      runner.on(C.EVENT_TEST_FAIL, (t, e) =>
        results.push({ title: t.fullTitle(), state: "failed", error: e && e.message }),
      );
      runner.on(C.EVENT_TEST_PENDING, (t) =>
        results.push({ title: t.fullTitle(), state: "pending" }),
      );
      await new Promise((res) => runner.once(C.EVENT_RUN_END, res));
      return { state: runner.state, stats: runner.stats, results };
    }, { filter: matchedKeys, mochaTimeout: MOCHA_TIMEOUT_MS }),
    new Promise((_, rej) => {
      timeoutId = setTimeout(() => rej(new Error(`Quench run exceeded ${TIMEOUT_S}s`)), TIMEOUT_S * 1000);
    }),
  ]);
  clearTimeout(timeoutId); // else this pending timer keeps Node alive for the full TIMEOUT_S

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      { git, when: new Date().toISOString(), filter: FILTER, ...data, errCounts },
      null,
      2,
    ),
  );

  const failed = data.results.filter((r) => r.state === "failed");
  console.log(`\n=== Quench results @ ${git.branch} (${git.sha}) filter=${FILTER} ===`);
  console.log(
    `passed: ${data.stats.passes}  failed: ${data.stats.failures}  pending: ${data.stats.pending}  (${data.stats.duration}ms)`,
  );
  for (const f of failed) console.log(`\nFAIL ${f.title}\n  ${f.error}`);
  console.log(`\nFull report: ${OUT}`);
  process.exitCode = failed.length > 0 ? 1 : 0;
} catch (err) {
  console.error(`Harness error: ${err.message}`);
  process.exitCode = 2;
} finally {
  clearTimeout(timeoutId); // also the error path, where the race rejected via page.evaluate
  await browser.close();
}
