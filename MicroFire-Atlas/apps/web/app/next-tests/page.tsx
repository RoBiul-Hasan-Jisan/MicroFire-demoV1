import type { Metadata } from "next";
import nextJson from "@/data/next_experiments.json";
import modelJson from "@/data/model.json";
import type { Model } from "@/lib/model";
import sensJson from "@/data/next_experiments_sensitivity.json";
import type { NextTests, Sensitivity } from "@/lib/next-tests";
import { NextTestsView } from "@/components/insight/NextTests";

export const metadata: Metadata = { title: "Next tests" };

export default function NextTestsPage() {
  const data = nextJson as unknown as NextTests;
  const model = modelJson as unknown as Model;
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <p className="text-signal text-sm">Research planner</p>
      <h1 className="display text-4xl mt-2">Which test should NASA run next?</h1>
      <p className="mt-3 text-muted max-w-[78ch]">
        The Evidence Ladder tells you where NASA has no test. This page turns that gap into a ranked shopping list: for each possible new test it asks how much the answer would shrink our uncertainty about Moon and Mars cabins, then picks tests one after another so none is wasted. It is a research-planning aid, not a NASA test plan, and it works inside the limits of a small model.
      </p>
      <NextTestsView data={data} o2Max={model.ranges.o2_pct[1]} sens={sensJson as unknown as Sensitivity} />
    </div>
  );
}
