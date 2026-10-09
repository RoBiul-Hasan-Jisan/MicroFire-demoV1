import test from "node:test";
import assert from "node:assert/strict";
import { KID_FRESH, QUIZ, stickersOf } from "./kid-play.ts";

test("fresh save has no stickers", () => assert.deepEqual(stickersOf(KID_FRESH), []));
test("every quiz answer index is valid", () => QUIZ.forEach((q) => assert.ok(q.answer >= 0 && q.answer < q.options.length)));
test("all four patches unlock the last one", () => {
  const s = stickersOf({ worlds: ["earth", "moon", "mars", "micro"], bestStreak: 20, quizBest: QUIZ.length, quizDone: true });
  assert.equal(s.length, 5);
  assert.ok(s.includes("super"));
});
