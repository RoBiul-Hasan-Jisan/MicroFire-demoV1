# What still needs real data, and how to do it

Everything below could not be completed inside the sandbox this version was built in: it had no access to NASA's servers (NTRS, the Space Station Research Explorer, NASA Image Library), and the project's rule is that no number is ever invented. Each item says what to get, where it goes, and which command refreshes the site afterwards. Items are ordered by how much they raise the project.

## 1. Real partial-gravity results (highest value)
**Why:** the Gravity bridge is an unvalidated hypothesis. A handful of real lunar or Martian gravity results turns it into "agrees / partly agrees / disagrees".
**Where to look:** NASA Technical Reports Server (ntrs.nasa.gov) and Space Station Research Explorer. Search for partial-gravity material flammability (parabolic-flight and drop-tower work), the Saffire/other flight experiments' reduced-gravity follow-ups, and NASA's lunar-gravity flammability publications. Note: any paper that states oxygen, flow (or "no forced flow") and whether the flame was sustained at 0.17 g or 0.38 g is usable.
**What to enter:** one row per test in `data/curated/partial_gravity_validation.csv`
`id, citation, gravity (lunar|martian), o2_pct, forced_flow_cm_s, flow_direction, material, outcome_group (sustained|extinguished|not_ignited)`. The `citation` (report, table, page) is mandatory; the loader refuses rows without it.
**Then run:** `python3 pipelines/retrain.py` (re-weights the bridge, regenerates the next-test plan and sensitivity, appends the changelog) and `cd apps/web && npm test`.
**Also useful:** the 1 g comparison for the same materials. The atlas has no Earth-gravity data, so one claim ("low-g burns at lower oxygen") cannot be tested until it does.

## 2. Pressure for the BASS tests
**Why:** pressure is stated for only 20 of the 49 labelled tests, so it cannot be a model input (`/limiting-oxygen` shows the check). The exploration atmospheres differ mainly in pressure.
**What to do:** read the BASS / BASS-II test-condition tables in the NASA reports already listed on `/sources`; where chamber pressure is stated, add it to the matching row (via `data/curated/extra_runs.csv` for new rows, or the curated BASS tables for existing ones). Do not infer "ambient" unless the report says so.
**Then run:** `python3 pipelines/retrain.py`. If the pressure check then reports `pressure_helps`, add pressure (or partial pressure of oxygen) to `FEATURES_SEL` in `pipelines/train_models.py` and compare the honest (nested) score.

## 3. Low-airflow flame videos and stills (turns "Burning but unseen" into a measurement)
**Why:** none of the four NASA media items in the atlas states its airflow, and none is below 5 cm/s, so no measured visibility-vs-airflow curve exists. NASA's BASS imagery at the lowest flows is what is needed.
**What to do:** (a) download BASS / BASS-II images or videos from the NASA Image Library, add them to `data/media.json`, run `python3 pipelines/flame_vision.py`; (b) for each, read the test conditions from the matching report and fill `flow_cm_s`, `o2_pct` and `citation` in `data/curated/visibility_manifest.json`.
**Then run:** `python3 pipelines/visibility_measured.py`. With at least 4 cited items a curve appears in `apps/web/data/visibility_measured.json`; wiring it into a chart on `/unseen` is a small change (the table there already reads this file).

## 4. Check the three assumptions that are ours
`u_ref` (buoyant-flow scale) and the extrapolation spread `kappa` are assumptions (see `/gravity-bridge` and `/next-tests`; the sensitivity table shows how much they matter). If you find a published estimate of the buoyant velocity or flame length for NASA-sized samples, put the value and citation in `data/curated/gravity_bridge_spec.json` (`derivation`) and rerun `python3 pipelines/retrain.py`.

## 5. Ask page does not know the new tools
The Ask PIX answers are built from NASA records plus one model item. The next-test plan, the bridge, the limiting-oxygen curve and the unseen map are not Ask evidence items, and the frozen evaluation set (MicroFire-Eval v1) covers none of them. Adding them means new evidence item keys in `lib/ask-core.ts`, matching gold answers in a v2 eval, and running the live evaluation (`lib/eval-live.ts`) with an API key. The new tools are covered by unit tests instead (`lib/*.test.ts`).

## 6. Checks to do on a real machine
- `npm install && npm run build` (the sandbox build had Google Fonts stubbed out).
- Open every page on a phone and a laptop; run an accessibility checker (axe or Lighthouse). Nothing here was viewed in a browser.
- Run `apps/web/e2e/new-pages.spec.ts` with Playwright (instructions at the top of the file); it has never been run.
- Deploy (see `docs/DEPLOY.md`) and rehearse `docs/DEMO_SCRIPT.md`.

## 7. Do not claim "never built before" without checking
Read `docs/research-competitors.md` and search the other 2026 Space Apps teams for this challenge. The honest wording is "to our knowledge".
