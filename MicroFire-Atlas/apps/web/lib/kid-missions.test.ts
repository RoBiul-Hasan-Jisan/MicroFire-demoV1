import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS, missionsDone, nextMission } from "./kid-missions.ts";
import { DEFAULT_STATE } from "./lab-model.ts";

test("default state completes no mission except none of the world ones", () => {
  const d = missionsDone({ st: DEFAULT_STATE, visited: [] }, []);
  assert.ok(d.includes("round"));
  assert.ok(!d.includes("tall"));
});
test("a feast completes the feast mission", () => assert.ok(missionsDone({ st: { ...DEFAULT_STATE, oxygen: 30 }, visited: [] }, []).includes("feast")));
test("wind only counts away from orbit", () => {
  assert.ok(!missionsDone({ st: { ...DEFAULT_STATE, flow: 30 }, visited: [] }, []).includes("wind"));
  assert.ok(missionsDone({ st: { ...DEFAULT_STATE, world: "earth", flow: 30 }, visited: [] }, []).includes("wind"));
});
test("saved missions stay done and next skips them", () => {
  const all = MISSIONS.map((m) => m.id);
  assert.equal(nextMission(all), null);
  assert.equal(nextMission(["tall"])!.id, "round");
});
test("nothing completes before the child acts", () => assert.deepEqual(missionsDone({ st: DEFAULT_STATE, visited: [] }, [], false), []));
