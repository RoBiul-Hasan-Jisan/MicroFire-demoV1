import type { Metadata } from "next";
import Link from "next/link";
import { media, MEDIA_CONTEXT } from "@/lib/media";
import { RouteStage } from "@/components/world/RouteStage";

export const metadata: Metadata = { title: "Flame Vision" };

export default function AnalyzeIndex() {
  return (
    <div className="explorer-page mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <RouteStage kind="analyze" mediaPoster={`/media/${media[0].slug}/${media[0].kind === "video" ? "poster" : "image"}.jpg`} mediaHref={`/analyze/${media[0].slug}`} />
      <p className="mt-6 text-sm text-muted max-w-[78ch]">
        NASA flame footage from the space station and Cygnus, measured with classical computer vision. Every overlay is
        computed, and every unit is pixels: NASA publishes no calibration for this footage.
      </p>
      <ul id="analyze-tool" className="scroll-mt-20 mt-8 grid gap-6 sm:grid-cols-2">
        {media.map((m) => (
          <li key={m.slug}>
            <Link href={`/analyze/${m.slug}`} className="film-card group block rounded-xl overflow-hidden border border-rule-strong bg-panel hover:border-signal">
              {/* eslint-disable-next-line @next/next/no-img-element -- static NASA poster */}
              <img src={`/media/${m.slug}/${m.kind === "video" ? "poster" : "image"}.jpg`} alt="" className="block w-full aspect-video object-cover bg-black" />
              <div className="p-4">
                <span className="film-kind">{m.kind === "video" ? "▶ Watch and investigate" : "◎ Inspect the photograph"}</span>
                <p className="font-semibold group-hover:text-signal">{MEDIA_CONTEXT[m.slug]?.label}</p>
                <p className="text-sm text-muted mt-1">
                  {m.kind === "video" ? `Video, ${Math.round(m.duration_s ?? 0)} s` : "Photograph"}, {m.center}, {m.date_created}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
