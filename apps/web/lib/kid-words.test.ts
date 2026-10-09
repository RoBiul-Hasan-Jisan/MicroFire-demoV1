import test from "node:test";
import assert from "node:assert/strict";
import { kidWords } from "./kid-words.ts";

test("orbit with a clear outcome mentions NASA's tests", () => {
  const l = kidWords({ world: "micro", oxygen: 21, flow: 10 }, "sustained");
  assert.equal(l.length, 4);
  assert.match(l[3], /mostly kept burning/);
});

test("other worlds never claim a NASA result", () => {
  const l = kidWords({ world: "earth", oxygen: 30, flow: 25 }, "limited");
  assert.match(l[1], /extra oxygen/);
  assert.match(l[2], /leans over/);
  assert.match(l[3], /does not count results/);
});

test("low airflow in orbit is explained", () => {
  assert.match(kidWords({ world: "micro", oxygen: 21, flow: 1 }, "unstated")[2], /fresh air barely reaches/);
});
