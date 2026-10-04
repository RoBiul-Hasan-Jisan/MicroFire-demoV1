import type { Metadata } from "next";
import modelJson from "@/data/model.json";
import bridgeJson from "@/data/gravity_bridge.json";
import nextJson from "@/data/next_experiments.json";
import findingsJson from "@/data/findings.json";
import { evidenceRecords } from "@/lib/data";
import type { Model } from "@/lib/model";
import type { BridgeSpec } from "@/lib/gravity-bridge";
import type { NextTests } from "@/lib/next-tests";
import type { Finding } from "@/lib/types";
import { BriefView } from "@/components/insight/BriefView";

export const metadata: Metadata = { title: "Cabin brief" };

export default function BriefPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <p className="text-signal text-sm">One page for a planner</p>
      <h1 className="display text-4xl mt-2">Cabin brief generator</h1>
      <p className="mt-3 text-muted max-w-[78ch]">
        Describe a cabin and its materials. The brief pulls together what NASA evidence exists, what the model can and cannot say, whether a fire could go unnoticed, and which tests would help most. Every line is traceable to the atlas; nothing is written by a language model. For a printable record of a single mission question, see the <a className="text-signal underline" href="/mission/brief">Mission Evidence Brief</a>.
      </p>
      <BriefView data={{ model: modelJson as unknown as Model, spec: (bridgeJson as unknown as { spec: BridgeSpec }).spec, next: nextJson as unknown as NextTests, records: evidenceRecords, findings: findingsJson as unknown as Finding[] }} />
    </div>
  );
}
