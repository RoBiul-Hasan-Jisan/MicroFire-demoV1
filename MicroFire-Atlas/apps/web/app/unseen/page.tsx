import type { Metadata } from "next";
import modelJson from "@/data/model.json";
import findingsJson from "@/data/findings.json";
import type { Model } from "@/lib/model";
import type { Finding } from "@/lib/types";
import visJson from "@/data/visibility_measured.json";
import { FINDINGS } from "@/lib/unseen";
import { UnseenMapView } from "@/components/insight/UnseenMap";
import css from "@/components/insight/Insight.module.css";

export const metadata: Metadata = { title: "Burning but unseen" };

type Measured = { status: string; how_to_extend: string; curve_available: boolean; items: { slug: string; frames: number; share_frames_with_flame: number | null; luminous_share_of_flame_px: number | null; blue_share_of_flame_px: number | null; share_frames_overexposed: number | null; in_curve: boolean }[] };

export default function UnseenPage() {
  const model = modelJson as unknown as Model;
  const byId = Object.fromEntries((findingsJson as unknown as Finding[]).map((f) => [f.id, f.quote]));
  const vis = visJson as unknown as Measured;
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <p className="text-signal text-sm">Where detection could fail</p>
      <h1 className="display text-4xl mt-2">Burning but unseen</h1>
      <p className="mt-3 text-muted max-w-[78ch]">
        A fire you can see is a fire you can fight. NASA reports that at very low airflow, microgravity flames turn dim, blue and stable, and can burn for a long time. This map combines that with the outcome model to show where a flame could plausibly persist without being noticed, and, just as important, where nobody has any data.
      </p>
      <div className={css.card} style={{ marginTop: 24, borderColor: "var(--flame)" }}>
        <p className="font-semibold">The key finding is an absence. No labelled test in the atlas has airflow below {model.ranges.flow_cm_s[0]} cm/s.</p>
        <p className="text-sm text-muted mt-1">The regime NASA describes as dim blue and very stable (below 1 cm/s) exists in the atlas only as text. The model cannot speak there, so the map marks it “?” instead of colouring it. This is a visibility hint built from cited statements, not a measured visibility score.</p>
      </div>
      <UnseenMapView model={model} />
      <div className={css.page}>
        <section className={css.card} aria-labelledby="said">
          <h2 id="said" className="display text-xl">What NASA wrote</h2>
          <ul className="mt-3 grid gap-3">
            {[FINDINGS.dim, FINDINGS.sensitive, FINDINGS.undetected].map((id) => <li key={id} className={css.quote}>{byId[id]}</li>)}
          </ul>
        </section>
        <section className={css.card} aria-labelledby="seen">
          <h2 id="seen" className="display text-xl">What our own detector measured in NASA media</h2>
          <p className="text-sm mt-2 max-w-[78ch]">{vis.status}</p>
          <div className={`${css.scroll} mt-3`}>
            <table className={css.tbl}>
              <thead><tr><th>NASA media</th><th>Frames</th><th>Flame found</th><th>Bright (luminous) share</th><th>Blue share</th><th>Overexposed frames</th></tr></thead>
              <tbody>{vis.items.map((i) => <tr key={i.slug}><td>{i.slug}</td><td className={css.mono}>{i.frames}</td><td className={css.mono}>{i.share_frames_with_flame != null ? `${Math.round(i.share_frames_with_flame * 100)} %` : "—"}</td><td className={css.mono}>{i.luminous_share_of_flame_px != null ? `${Math.round(i.luminous_share_of_flame_px * 100)} %` : "—"}</td><td className={css.mono}>{i.blue_share_of_flame_px != null ? `${Math.round(i.blue_share_of_flame_px * 100)} %` : "—"}</td><td className={css.mono}>{i.share_frames_overexposed != null ? `${Math.round(i.share_frames_overexposed * 100)} %` : "—"}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-sm mt-3 max-w-[78ch]">Two different ways to miss a flame show up. The large Saffire fires are so bright that most frames are overexposed, so a detector can saturate. The small BASS stills are dominated by blue pixels, the dim kind a detector tuned for bright yellow flame would not count. The atlas does not record the airflow for these media, so they are not yet placed on an airflow curve.</p>
          <p className="text-xs text-muted mt-2">Pixel counts only, no spatial calibration. Two stills and two videos are an illustration, not a statistic. {vis.how_to_extend}</p>
        </section>
      </div>
    </div>
  );
}
