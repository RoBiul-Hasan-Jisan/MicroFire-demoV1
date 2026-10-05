import { experiments, findings, saffireRuns, luciRuns } from "@/lib/data";
import { EXAMPLE_ANSWER, EXAMPLE_PROVENANCE, EXAMPLE_QUESTION, verifiedExample } from "@/lib/ask-example";
import { ClaimTrace } from "./ClaimTrace";

export function VerifiedExample() {
  const result = verifiedExample(experiments, findings, saffireRuns, luciRuns);
  if (!result.valid) return <section className="verified-example"><h2>Example withheld</h2><p>The saved synthesis no longer passes the current checker.</p></section>;
  return <section className="verified-example" aria-labelledby="example-title">
    <header><p className="text-signal text-sm">How an AI answer is checked · verified example, no API key required</p><h2 id="example-title" className="display text-2xl mt-2">{EXAMPLE_QUESTION}</h2></header>
    <ClaimTrace question={EXAMPLE_QUESTION} summary={EXAMPLE_ANSWER.summary} claims={result.checked} items={result.evidence.items} provenance={EXAMPLE_PROVENANCE} />
    <p className="text-sm text-muted mt-4">Near-matched runs show an association; they do not isolate airflow as the cause. Fan settings are not calibrated velocities.</p>
  </section>;
}
