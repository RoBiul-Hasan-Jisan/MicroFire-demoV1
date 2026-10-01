import type { Metadata } from "next";
import { Cite, Quote } from "@/components/Cite";
import { GapMap } from "@/components/GapMap";
import { findings } from "@/lib/data";

export const metadata: Metadata = { title: "Evidence gaps" };

const GAP_QUOTES = ["luci-first-lunar", "low-g-burns-lower-o2", "exploration-atmosphere", "saffire-vs-bass"];

export default function GapsPage() {
  const quotes = GAP_QUOTES.map((id) => findings.find((f) => f.id === id)!);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <h1 className="display text-3xl sm:text-4xl">Where the evidence stops</h1>
      <p className="mt-3 text-muted max-w-[70ch]">
        Safer exploration starts with knowing what NASA&apos;s tests actually covered. Dense cells are well observed;
        dashed cells have no test at all.
      </p>

      <div className="mt-10">
        <GapMap />
      </div>

      <section className="mt-20">
        <h2 className="display text-2xl">Gaps the map cannot show</h2>
        <dl className="mt-6 grid gap-px bg-rule border border-rule md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Gravity", "Every test in this atlas ran in orbit. None ran at lunar or Martian gravity."],
            [
              "Pressure",
              "Every test with a documented pressure ran near 1 atm (the Nomex rows state none). NASA's recommended exploration atmosphere is 56.5 kPa.",
            ],
            ["Materials", "Three materials: PMMA, SIBAL cotton–fiberglass fabric and Nomex. Real cabins hold many more."],
            [
              "Scale",
              "Thin samples a few centimetres wide in a small duct. NASA reports that larger Saffire burns of the same fabric spread significantly slower, so small-duct results may not scale up.",
            ],
          ].map(([k, v]) => (
            <div key={k} className="bg-void p-6">
              <dt className="font-semibold">{k}</dt>
              <dd className="mt-2 text-[15px] text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16">
        <h2 className="display text-2xl">What NASA says about the edges of this evidence</h2>
        <div className="mt-8 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {quotes.map((f) => (
            <Quote key={f.id} f={f} />
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Lunar and Martian results exist in NASA&apos;s reports but are not yet transcribed into test-level rows here.{" "}
          <Cite sourceId="partial-g" />, <Cite sourceId="luci" />
        </p>
      </section>
    </div>
  );
}
