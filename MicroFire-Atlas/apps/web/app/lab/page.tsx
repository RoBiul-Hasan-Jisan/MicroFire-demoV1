import type { Metadata } from "next";
import { FlameLab } from "@/components/lab/FlameLab";
import { experiments } from "@/lib/data";
import { deployedSnapshot } from "@/lib/model-lab";

export const metadata: Metadata = {
  title: "Flame Lab",
  description: "An interactive combustion chamber: set gravity, oxygen, airflow, pressure and material, and see what NASA actually tested, what is analogous, and where the evidence stops.",
};

export default function LabPage() {
  return (
    <div data-flame-lab>
      <h1 className="sr-only">MicroFire Flame Lab</h1>
      <FlameLab snap={deployedSnapshot(experiments)} />
    </div>
  );
}
