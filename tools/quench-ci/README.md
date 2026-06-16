# Quench CI runner

Runs the OSE system's [Quench](https://github.com/Ethaks/FVTT-Quench) test
batches headlessly against a real Foundry VTT server, driven with Playwright.
The GitHub Actions workflow at `.github/workflows/quench.yml` wires these
scripts together; everything here also runs locally against a scratch Foundry
container.

## In CI (maintainer setup)

The workflow needs two repository secrets — a foundryvtt.com account that holds
a license (Settings → Secrets and variables → Actions):

| Secret | Purpose |
| --- | --- |
| `FOUNDRY_USERNAME` | account email/username; felddy uses it to download Foundry and fetch the license at boot |
| `FOUNDRY_PASSWORD` | account password |

The job fails fast with a clear message if either is missing. One license = one
concurrent server, so the workflow's `concurrency` group serializes runs.

**When it runs:** push to `main`, PRs against `main`, and `workflow_dispatch`
all run the full suite (~15-18 min on 2-core runners). Same-repo PRs run
automatically. Because GitHub never exposes secrets to fork-PR workflows, fork
PRs use `pull_request_target` and run **only after a maintainer applies the
`safe-to-test` label** — the workflow checks out the PR head, so labeling is an
explicit "I reviewed this diff" gate. See the header comment in
`.github/workflows/quench.yml`.

## Pieces

| File | Role |
| --- | --- |
| `setup-data-dir.sh` | Assembles a Foundry `/data` dir: builds-in the OSE system masqueraded as `ose` v`999.0.0-dev` (id patched + `ose-dev`→`ose` in `dist`, exactly like `release.yml`), downloads the latest Quench module, and drops in the minimal `quench-ci` world fixture. |
| `fixtures/world/world.json` | Bare world manifest (system `ose`, no content). Foundry creates the LevelDB databases and a passwordless Gamemaster on first launch, so no binary world data is committed. |
| `activate-world.mjs` | First-boot activation, in two phases around a container restart: `--phase eula` accepts the EULA (this is what generates the host-bound license **signature** — it cannot be pre-committed); the caller then restarts the container (clearing the stale `Config/options.json.lock` Foundry leaves behind) so felddy's `FOUNDRY_WORLD` auto-launch activates the world server-side; `--phase await` polls `/api/status` until active. Driving the setup UI's launch control instead proved version-fragile (migration-confirm dialog on core-version drift, hover-revealed control, telemetry prompt). |
| `run-quench.mjs` | Joins as Gamemaster, optionally enables the Quench module at runtime + reloads, runs the batches, and writes a JSON report. Exits non-zero on any test failure. |

## Why activation is a runtime step

A felddy container fetches the license **key** at boot, but Foundry v13 still
requires a one-time EULA acceptance that produces an instance-bound license
**signature**, plus a world launch to materialise the world databases. Both are
environment-specific, so they happen against the live server rather than via
pre-baked `license.json` / LevelDB files. The world launch itself is delegated
to felddy's `FOUNDRY_WORLD` auto-launch on a post-EULA container restart, which
also migrates world data silently when the server's core version is newer than
the fixture's `coreVersion`.

## Running locally

```sh
# 1. Build the system at the repo root.
npm ci && npm run build

# 2. Assemble a scratch data dir.
DATA=/tmp/quench-data
tools/quench-ci/setup-data-dir.sh "$DATA" "$PWD"

# 3. Boot Foundry (felddy). Needs foundryvtt.com creds; pick a free port.
#    CONTAINER_CACHE persists the ~150 MB Foundry zip between runs.
docker run -d --name foundry-ci -p 30001:30000 -v "$DATA:/data" \
  -e FOUNDRY_USERNAME=... -e FOUNDRY_PASSWORD=... \
  -e CONTAINER_CACHE=/data/container_cache -e FOUNDRY_WORLD=quench-ci \
  felddy/foundryvtt:13

# 4. Once `docker inspect -f '{{.State.Health.Status}}' foundry-ci` is healthy:
cd tools/quench-ci
npm install && npx playwright install chromium
node activate-world.mjs --phase eula --url http://localhost:30001
docker stop -t 30 foundry-ci
rm -rf "$DATA/Config/options.json.lock"   # Foundry always leaves this behind
docker start foundry-ci
node activate-world.mjs --phase await --url http://localhost:30001
node run-quench.mjs --url http://localhost:30001 --user Gamemaster \
  --enable-module quench --filter "**" --out /tmp/quench-report.json
```

`run-quench.mjs` exit codes: `0` all passed, `1` test failures, `2` harness
error. Pass `--filter "ose.actor.**"` to scope to a batch group; a zero-match
filter fails fast. Batch keys are registered in `src/e2e/index.ts`.
