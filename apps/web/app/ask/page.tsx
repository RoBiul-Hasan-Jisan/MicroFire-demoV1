import type { Metadata } from "next";
import Link from "next/link";
import { AskPanel } from "@/components/AskPanel";

export const metadata: Metadata = { title: "Ask" };

export default function AskPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <h1 className="display text-3xl sm:text-4xl">Ask the evidence</h1>
      <p className="mt-3 text-muted max-w-[70ch]">
        Questions are answered only from the NASA tests and quotes in this atlas. Every claim is labelled as observed,
        derived, interpretation or data gap, and its citations are checked before you see it.{" "}
        <Link href="/methodology#ai" className="link">
          How the AI is constrained
        </Link>
      </p>
      <div className="mt-10">
        <AskPanel />
      </div>
    </div>
  );
}
