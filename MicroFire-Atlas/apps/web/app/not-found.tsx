import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-24 text-center">
      <p className="text-signal text-sm">404</p>
      <h1 className="display text-3xl mt-2">No page here.</h1>
      <p className="mt-3 text-muted">These are the places most people want.</p>
      <ul className="mt-8 flex flex-wrap justify-center gap-3">
        <li><Link href="/will-it-burn" className="story-cta">Check a cabin</Link></li>
        <li><Link href="/atlas" className="border border-rule-strong px-5 py-3 rounded-full hover:border-signal inline-block">Atlas</Link></li>
        <li><Link href="/gaps" className="border border-rule-strong px-5 py-3 rounded-full hover:border-signal inline-block">Research Frontier</Link></li>
        <li><Link href="/" className="border border-rule-strong px-5 py-3 rounded-full hover:border-signal inline-block">Home</Link></li>
      </ul>
    </div>
  );
}
