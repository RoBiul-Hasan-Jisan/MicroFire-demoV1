# Evidence-core additions (from the FlameScope comparison)

## What was added
| Item | Where |
|---|---|
| Strict applicability rule (a test counts only if its own row records every condition, no interpolation) | `apps/web/strict/src/compute/applicability.mjs`, used by `/will-it-burn` |
| Rule-based question reader with "Read as" chips, notices and an **Unclear** verdict | `strict/src/compute/question.mjs` |
| Burned / Mixed / No flame held / No data / Unclear verdicts, closest tests, "nearest evidence" button, "where the data may exist" cards | `/will-it-burn`, `app/api/strict/route.ts` |
| NASA's 8-step ISS fire response (OCHMO-TB-008) with evidence status per step; FLEX CO2/helium counts (PSI-69); SAME smoke records | `/fire-response`, `strict/data/fire-response.json`, `psi-69-flex.csv` |
| Fabric (23 tests) and Nomex (3 tests) as separate evidence sets; Saffire-II (PSI-99) shown beside answers | `strict/data/` |
| MCP server (`will_it_burn`, `search_evidence`, `compare_tests`, `evidence_brief`, `get_provenance`) | `.mcp.json` -> `apps/web/strict/src/agents/mcp-server.mjs` |
| Compute boundary test (no model call or network in the science code) and 20-question retrieval/abstention eval | `strict/test/boundary.test.mjs`, `strict/scripts/evaluate.mjs` |
| Offline run of the evidence core | `OFFLINE=1 node strict/src/api/server.mjs` (standalone copy of their UI) |

## Source and licence
`apps/web/strict/` is the FlameScope evidence core, a sister project by the same team (Apache-2.0). Keep `strict/LICENSE` in place (the licence
requires it). In the write-up, name FlameScope's evidence core as a component and say which of its tables came from NASA (BASS-II, PSI-25, PSI-69, PSI-99).
Our own additions are the API route, the two pages, the nav links and the MCP config.

## Checked
- `cd apps/web/strict && node --test`: 83 of 83 pass.
- Dev server: `/api/strict` answers, `/will-it-burn` and `/fire-response` return 200 (8 steps). Not viewed in a browser. `next build` could not finish here only because Google Fonts is blocked; run it on a normal machine.
- `npx tsc --noEmit` reports `PageProps`/`LayoutProps` errors in older pages; they come from Next's generated types (run `npx next typegen`), not from the new files.

## AI-use disclosure (draft: add your own tools and prompts)
- Claude (Anthropic): compared the two repositories; vendored the evidence core; wrote the `/api/strict` route, `/will-it-burn`, `/fire-response`, nav entries, MCP config and this document; searched the web for the Bangladesh figures below.
- Everything else (data transcription, model training, Ask page, game and story pages): list the tool, the prompt, and what you checked by hand.
- Rule used: no number is entered without a source. Claude's search results are news reports, so each figure below still needs a person to open the source and confirm.

## Bangladesh impact (sourced 4 Oct 2026; confirm each link before publishing)
Frame the impact as the method, not the microgravity data: a fire-safety decision should say whether the evidence covered the real conditions.

| Fact | Figure | Source | Note |
|---|---|---|---|
| Fires in Bangladesh in 2025 | 27,059 (about 75 a day) | FSCD press release of 10 Feb 2026, reported by [The Daily Star](https://www.thedailystar.net/news/bangladesh/accidents-fires/news/bangladesh-saw-75-fires-day-2025-fire-service-4102796), [TBS](https://www.tbsnews.net/bangladesh/over-27000-fires-2025-75-day-average-fire-service-report-1357271), [bdnews24](https://bdnews24.com/bangladesh/c224c27c2bb9) | Get the FSCD release itself and cite it first. |
| Deaths and injuries in those fires | 85 dead, 267 injured | same | One TBS chart says 88 deaths. Use 85 (the release) and note the difference. |
| Leading cause | Electrical faults: 9,392 fires (34.71%) | [Bonik Barta](https://en.bonikbarta.com/bangladesh/1gaJKyaseexoSHsC) | |
| Where | Residential buildings: 8,705 fires (32.17%) | same | |
| Property damage | Tk 569.97 crore | [TBS](https://www.tbsnews.net/bangladesh/over-27000-fires-2025-75-day-average-fire-service-report-1357271) | Another outlet printed Tk 56.99 crore, a typo. Check the release. |
| Buildings inspected | 10,533, of which 622 highly risky and 3,316 risky | [Financial Express](https://thefinancialexpress.com.bd/national/over-27000-fire-incidents-recorded-in-bangladesh-in-2025) | |
| Bailey Road fire, 29 Feb 2024 | 46 deaths (20 men, 18 women, 8 children) | [Dhaka Tribune](https://www.dhakatribune.com/bangladesh/court/412601/bailey-road-fire-case-hakka-dhaka-owner-withdraws), [ILO/UN Bangladesh](https://bangladesh.un.org/en/263549-bailey-road-restaurant-and-other-recent-fire-incidents-show-again-how-enforcement-prevention) | Prothom Alo reported carbon monoxide poisoning as the cause of death in the cases examined. |
| Tazreen Fashions fire, 24 Nov 2012 | At least 112 dead | [European Parliament resolution](https://www.europarl.europa.eu/doceo/document/B-7-2013-0020_EN.html) (government figures); [IndustriALL](https://www.industriall-union.org/justice-at-last-for-tazreen-fire-victims) | Later reports say 113 to 117; say "at least 112". |

A real link to the NASA data, if you want one: the atlas quotes NASA's Saffire finding that smoke, not heat, is the main hazard of a spacecraft fire,
and the Bailey Road fatalities were reported as smoke and carbon monoxide poisoning. State this as a parallel, not as proof.
Do not claim the microgravity results apply to Bangladeshi buildings.

## Still missing
- Real partial-gravity and pressure data (`docs/TODO_REAL_DATA.md`); this sandbox cannot reach NASA.
- The Ask page and the trained model do not use the strict check yet; they sit side by side.
- A reviewer protocol and usability test with real people.
- Browser, phone and accessibility checks.
