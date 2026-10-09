import type { Metadata } from "next";
import { MissionFreefall } from "@/components/game/MissionFreefall";

export const metadata: Metadata = {
  title: "Mission Freefall",
  description: "Build NASA's space-station fire experiment, light a sample in zero gravity, and predict what real flames did.",
};

export default function StoryPage() {
  return <MissionFreefall />;
}
