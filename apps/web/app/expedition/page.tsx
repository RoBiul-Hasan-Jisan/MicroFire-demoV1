import type { Metadata } from "next";
import { EvidenceExpedition } from "@/components/game/EvidenceExpedition";
import analysis from "@/public/media/bass2-reduced-o2-gmt213/analysis.json";
import type { FrameMetrics } from "@/lib/media";

export const metadata: Metadata = { title: "Follow the Spark", description: "A children's evidence adventure: inspect NASA flames, measure real images, compare tests and discover what the Moon still needs us to learn." };
export default function ExpeditionPage() {
  return <EvidenceExpedition trace={analysis.frames[0] as unknown as FrameMetrics} />;
}
