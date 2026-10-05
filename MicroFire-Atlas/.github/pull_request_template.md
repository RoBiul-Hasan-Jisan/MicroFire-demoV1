## What and why
<!-- One or two sentences. Link the issue: Closes #123 -->

## Type
- [ ] Code or UI  - [ ] NASA data (rows or findings)  - [ ] Docs  - [ ] Tests only

## Checklist
- [ ] `cd apps/web && npm run typecheck && npm test` pass
- [ ] If Python or data changed: `python3 -m unittest discover tests` passes (some tests need `pipelines/fetch_sources.py` first)
- [ ] New NASA values have a citation (report, table, PDF page). Nothing is estimated or invented.
- [ ] No safety score, risk probability or "safe on the Moon" wording added
- [ ] Anything illustrated or simulated is labelled as such
- [ ] Screenshot attached for UI changes
