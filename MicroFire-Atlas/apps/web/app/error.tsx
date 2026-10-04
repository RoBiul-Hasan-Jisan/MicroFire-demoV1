"use client";

import Link from "next/link";

/** Any page that throws shows this instead of a blank screen. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-24 text-center">
      <p className="text-signal text-sm">Something broke</p>
      <h1 className="display text-3xl mt-2">This page could not load.</h1>
      <p className="mt-3 text-muted">The rest of the atlas still works. Try again, or go back home.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="story-cta">Try again</button>
        <Link href="/" className="border border-rule-strong px-5 py-3 rounded-full hover:border-signal">Home</Link>
      </div>
    </div>
  );
}
