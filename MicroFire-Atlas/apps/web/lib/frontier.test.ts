import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromBass, fromSaffire } from "./ontology.ts";
import { FRONTIER, frontier } from "./frontier.ts";

const read = (n: string) => JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), "utf8"));
const records = [...read("experiments").map(fromBass), ...read("saffire").map(fromSaffire)];
const findings = read("findings");
const entry = (id: string) => frontier(FRONTIER.find((f) => f.id === id)!, records, findings);

test("the Moon base is an open frontier with named reasons, citing NASA for the gravity gap", () => {
  const e = entry("moon-base");
  assert.equal(e.closed, false);
  assert.deepEqual(e.missing.sort(), ["gravity", "oxygen"]);
  assert.ok(e.why.some((w) => w.finding === "luci-first-lunar"));
  assert.ok(e.why.some((w) => /highest is 31 % \(Saffire VI sample VI-2\)/.test(w.text)));
  assert.match(e.next ?? "", /FM2/);
  assert.match(e.know[0], /Saffire VI sample VI-3/);
});

test("the ISS with fans off is answered by direct evidence", () => {
  const e = entry("iss-still-air");
  assert.equal(e.closed, true);
  assert.equal(e.dontKnow, null);
  assert.equal(e.next, null);
});
