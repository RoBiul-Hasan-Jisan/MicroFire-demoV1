import type { Metadata } from "next";
import modelJson from "@/data/model.json";
import bridgeJson from "@/data/gravity_bridge.json";
import findingsJson from "@/data/findings.json";
import type { Model } from "@/lib/model";
import { checkClaims, type BridgeSpec } from "@/lib/gravity-bridge";
import type { Finding } from "@/lib/types";
import { GravityBridgeView } from "@/components/insight/GravityBridge";

export const metadata: Metadata = { title: "Gravity bridge (hypothesis)" };

export default function GravityBridgePage() {
  const model = modelJson as unknown as Model;
  const { spec, validation } = bridgeJson as unknown as { spec: BridgeSpec; validation: { n: number } };
  const checks = checkClaims(model, spec);
  const quotes = Object.fromEntries((findingsJson as unknown as Finding[]).map((f) => [f.id, f.quote]));
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <p className="text-signal text-sm">Hypothesis, not a prediction</p>
      <h1 className="display text-4xl mt-2">From the ISS to the Moon and Mars</h1>
      <p className="mt-3 text-muted max-w-[78ch]">
        Every NASA test in the atlas is in microgravity, yet the missions are at lunar and Martian gravity. This page shows one transparent way to bridge that gap, with every assumption exposed and adjustable, and then holds it against what NASA has already reported. Treat the curves as a question to test, not an answer.
      </p>
      <GravityBridgeView model={model} spec={spec} checks={checks} quotes={quotes} validationN={validation.n} />
    </div>
  );
}
