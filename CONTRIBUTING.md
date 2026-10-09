# Contributing to MicroFire Atlas

Thank you for helping. Whether you fix a typo, add a cited NASA test or build a feature, this guide gets you from zero to a pull request quickly.

## 1. Five-minute setup

You need **Node 22+**. Python 3.12+ is needed only for the data pipelines.

```bash
git clone <your-fork-url> && cd MicroFire-Atlas/apps/web
npm install
npm run dev          # http://localhost:3000
npm test             # fast: ~180 tests, no network
npm run typecheck
```

The site works without any API key. To try AI answers on `/ask`, add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to `apps/web/.env.local`. Never commit it.

Data side (optional):

```bash
pip install -r pipelines/requirements.txt
python3 -m unittest tests.test_model tests.test_flame_vision tests.test_insight_pipelines tests.test_next_experiments
python3 pipelines/fetch_sources.py    # downloads NASA PDFs (needs pdftotext); enables tests.test_build_dataset
```

## 2. Where things live

| I want to change… | Look in |
|---|---|
| A page or route | `apps/web/app/<route>/page.tsx` |
| A UI component | `apps/web/components/` |
| Ranking, search, gaps, ladder logic | `apps/web/lib/*.ts` (each has a `*.test.ts`) |
| NASA test records, findings, sources | `data/curated/*` then `python3 pipelines/build_dataset.py` |
| Model training / next-test plan | `pipelines/` and `data/processed/` |
| Navigation | `apps/web/components/StationMap.tsx` (`NAV_GROUPS`) |
| Docs | `docs/`, `README.md` |

New in `/explore`: `lib/unified-search.ts`, `lib/evidence-tensions.ts`, `lib/evidence-timeline.ts`.

## 3. Good first contributions

- **Add a cited NASA test row.** Follow `docs/ADD_DATA.md`. Every row needs report, table and page.
- **Add a finding.** Quote must appear word for word in the source; the build checks it.
- **Improve a test.** Add edge cases to any `lib/*.test.ts`.
- **Accessibility.** Run Lighthouse or axe on a page and fix what it reports.
- **Translations and plain-language rewrites** of explainer text.
- **Run the Playwright spec** `apps/web/e2e/new-pages.spec.ts` and report what breaks.

## 4. Ground rules (the project's integrity promise)

These keep the atlas trustworthy, and tests enforce several of them:

1. **Never invent or estimate data.** If a source does not state a value, leave it empty.
2. **Every NASA value needs a citation** (report, table, PDF page). Quotes are verbatim.
3. **No safety ratings or fire-risk probabilities.** A gap is an open research question, not a verdict.
4. **Label what is not NASA evidence:** illustrations, simulations (e.g. LUCI), our heuristics, planned experiments (FM²).
5. **Don't merge physical regimes.** Microgravity, lunar and Martian results stay separate.
6. **Scores are project heuristics**, never described as NASA ratings.

## 5. Workflow

1. Open or comment on an issue so we can avoid duplicate work (small fixes can skip this).
2. Fork, then branch: `git checkout -b fix/short-description`.
3. Keep changes focused. One topic per pull request.
4. Add or update a test when you change logic.
5. Before pushing: `cd apps/web && npm run typecheck && npm test`.
6. Open the PR using the template. CI runs the same checks.
7. Commit messages: short imperative summary, e.g. `feat(explore): add source timeline`, `fix(gaps): handle missing pressure`, `data: add Saffire VI row`.

## 6. Code style

- TypeScript, strict. Prefer small pure functions in `lib/` and thin components.
- In `lib/`, import sibling modules with the `.ts` extension (the tests run with Node directly).
- Computed results should be deterministic and testable; no model calls in ranking code.
- Pages must work with keyboard and screen readers. Don't convey meaning by colour alone.
- Read `apps/web/AGENTS.md`: this Next.js version differs from older ones.

## 7. Getting help

Open an issue with the question label, or comment on your draft PR. No question is too small. By contributing you agree your work is released under the MIT license and to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
