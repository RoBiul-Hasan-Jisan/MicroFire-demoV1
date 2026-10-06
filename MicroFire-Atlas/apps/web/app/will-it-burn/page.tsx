import type { Metadata } from "next";
import { StrictAsk } from "@/components/strict/StrictAsk";
import { WillItBurnLab } from "@/components/WillItBurnLab";
import { experiments, luciRuns, saffireRuns } from "@/lib/data";
import { toRows } from "@/lib/obsRows";

export const metadata: Metadata = { title: "Will it burn? Orbital ignition" };

export default function Page() {
  return (
    <>
      <WillItBurnLab rows={toRows(experiments, saffireRuns, luciRuns)} />
      <details className="mx-auto max-w-5xl px-4 pb-12"><summary className="cursor-pointer text-sm">Ask in words (strict evidence check)</summary><div className="mt-4"><StrictAsk /></div></details>
    </>
  );
}
