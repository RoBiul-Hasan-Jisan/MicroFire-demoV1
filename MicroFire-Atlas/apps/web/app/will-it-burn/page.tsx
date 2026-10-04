import type { Metadata } from "next";
import { StrictAsk } from "@/components/strict/StrictAsk";

export const metadata: Metadata = { title: "Will it burn? (strict evidence check)" };

export default function Page() {
  return (
    <div className="explorer-page mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <h1 className="display text-3xl">Will it burn? Did NASA test a cabin like yours?</h1>
      <p className="mt-3 text-muted max-w-[75ch]">
        Ask about a cabin. You get what NASA's tests saw, or exactly what they never covered. A question that cannot be read answers Unclear, never a guess.
        For a probability estimate, use the Outcome Model instead.
      </p>
      <div className="mt-8"><StrictAsk /></div>
    </div>
  );
}
