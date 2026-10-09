import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FlameAnnotator from "@/components/dev/FlameAnnotator";
import styles from "@/components/dev/FlameAnnotator.module.css";
import { candidates, devOnly, manifest } from "./store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Flame annotation (dev)", robots: { index: false } };

/** Dev-only tool for drawing human truth masks on candidate NASA frames. 404 in production. */
export default async function FlameAnnotationPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (!devOnly()) notFound();
  const list = candidates();
  const done = new Set(manifest().frames.map((f) => f.id));
  const { id } = await searchParams;
  const current = list.find((c) => c.id === id) ?? list.find((c) => !done.has(c.id)) ?? list[0];
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Flame Vision annotation</h1>
      <p className={styles.note}>
        Draw where you see flame in the original NASA frame. The pipeline&apos;s own mask is never shown here, so your
        mask stays independent of it. Only save a mask you drew and are willing to sign. {done.size} of {list.length} candidates annotated.
      </p>
      {!list.length ? (
        <p className={styles.note}>No candidates yet. Run <code>.venv/bin/python evaluation/flame-vision/select_candidates.py</code>.</p>
      ) : (
        <div className={styles.layout}>
          <nav aria-label="Candidate frames" className={styles.list}>
            <ol>
              {list.map((c) => (
                <li key={c.id}>
                  <Link href={`/dev/flame-annotation?id=${c.id}`} aria-current={c.id === current.id ? "true" : undefined}>
                    {done.has(c.id) ? "✓ " : ""}{c.slug} · {c.timestamp_s.toFixed(1)} s <small>{c.selection_reason.replaceAll("_", " ")}</small>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <FlameAnnotator key={current.id} id={current.id} width={current.frame_size[0]} height={current.frame_size[1]}
            label={`${current.slug} at ${current.timestamp_s} s (${current.selection_reason.replaceAll("_", " ")})`} sourceUrl={current.source_url} />
        </div>
      )}
    </main>
  );
}
