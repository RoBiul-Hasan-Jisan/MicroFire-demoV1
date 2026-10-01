import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlameVision } from "@/components/FlameVision";
import { getMedia, media, MEDIA_CONTEXT } from "@/lib/media";

export function generateStaticParams() {
  return media.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/analyze/[slug]">): Promise<Metadata> {
  const m = getMedia((await params).slug);
  return { title: m ? `Flame Vision: ${MEDIA_CONTEXT[m.slug]?.label ?? m.title}` : "Not found" };
}

export default async function AnalyzePage({ params }: PageProps<"/analyze/[slug]">) {
  const item = getMedia((await params).slug);
  if (!item) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <p className="text-sm text-muted">
        <Link href="/analyze" className="link">Flame Vision</Link> / {MEDIA_CONTEXT[item.slug]?.label}
      </p>
      <h1 className="display text-3xl sm:text-4xl mt-3">{MEDIA_CONTEXT[item.slug]?.label ?? item.title}</h1>
      <p className="mt-2 text-muted max-w-[70ch]">
        Real NASA footage, measured frame by frame with a documented computer-vision pipeline. Switch between the raw
        footage, the computed flame outline, and the measurements.
      </p>
      <div className="mt-8">
        <FlameVision item={item} />
      </div>
    </div>
  );
}
