import type { Metadata } from "next";
import Link from "next/link";
import { ScrollStory } from "@/components/ScrollStory";
import { GravityTeaser } from "@/components/world/GravityTeaser";

export const metadata: Metadata = { title: "Why flames change in space", description: "Switch gravity off, then scroll through three real NASA tests with different airflow and near-identical oxygen." };

/** The science explainer, moved off the home page so the home page stays short. */
export default function LearnPage() {
  return (
    <>
      <section className="home-gravity mx-auto max-w-7xl px-5 py-16 grid gap-8 lg:grid-cols-2 items-center">
        <div>
          <p className="text-signal">Your first mystery</p>
          <h1 className="display text-4xl mt-3">What happens when<br />gravity changes?</h1>
          <p className="text-muted mt-5 max-w-md">Try the switch. This illustration helps you imagine a change; real flames depend on their fuel, airflow, and surroundings too.</p>
          <Link href="/story" className="story-cta inline-flex mt-7">Build the 3D experiment</Link>
        </div>
        <GravityTeaser />
      </section>
      <div data-guide="scroll-story" id="scroll-story">
        <ScrollStory />
      </div>
    </>
  );
}
