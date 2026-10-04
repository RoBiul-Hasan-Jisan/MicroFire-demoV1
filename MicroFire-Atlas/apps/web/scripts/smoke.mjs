// Smoke test: every route answers 200 and contains its key phrase.
//   npm run build && npx next start -p 3111 &   then   node scripts/smoke.mjs http://localhost:3111
const base = process.argv[2] ?? "http://localhost:3111";
const checks = [
  ["/", "NASA fire tests"], ["/will-it-burn", "Will it burn"], ["/fire-response", ""], ["/impact", ""], ["/atlas", ""], ["/lab", ""], ["/expedition", ""], ["/predict", "keep burning"], ["/mission", "Evidence Ladder"], ["/gaps", ""], ["/ask", ""],
  ["/next-tests", "If NASA could run only"], ["/gravity-bridge", "Unvalidated hypothesis"], ["/unseen", "Burning but unseen"],
  ["/materials", "Evidence grade per material"], ["/brief", "Cabin brief"], ["/limiting-oxygen", "How much oxygen does a flame need"],
  ["/changelog", "Model changelog"], ["/methodology", ""], ["/sources", ""],
];
let bad = 0;
for (const [path, phrase] of checks) {
  try {
    const res = await fetch(base + path);
    const text = (await res.text()).replace(/<!-- -->/g, "");
    const ok = res.status === 200 && (!phrase || text.includes(phrase));
    console.log(`${ok ? "ok  " : "FAIL"} ${res.status} ${path}${ok || !phrase ? "" : `  (missing "${phrase}")`}`);
    if (!ok) bad++;
  } catch (e) { console.log(`FAIL ${path} ${e.message}`); bad++; }
}
process.exit(bad ? 1 : 0);
