import type { Metadata } from "next";
import impact from "@/data/impact/impact.json";

export const metadata: Metadata = { title: "Impact: who this helps, and what is measured" };

const AUDIENCES = [
  { who: "Spacecraft fire-safety engineers", gets: "The next-test planner ranks which experiments would remove the most uncertainty about Moon and Mars cabins, and the strict check says whether a cabin was ever tested.", href: "/next-tests" },
  { who: "Researchers and students", gets: "Cited, cleaned NASA test data you can search, compare and download, with missing values kept missing.", href: "/downloads" },
  { who: "AI agents and other tools", gets: "The same evidence rules over MCP, so any assistant can ask NASA's tests a question and cannot invent an answer.", href: "/will-it-burn" },
  { who: "Fire-safety teams in Bangladesh (method only)", gets: "The habit of checking that evidence covered your real conditions, and of saying what data is missing.", href: "#bangladesh" },
];

function fmt(n: number | null, unit: string) { return n === null ? "not measured yet" : `${n} ${unit}`; }

export default function Page() {
  const b = impact.bangladesh, s = impact.study;
  const max = Math.max(...b.places.map((p) => p.fires));
  const faster = s.median_seconds_with_nasa_pdfs && s.median_seconds_with_tool
    ? Math.round((1 - s.median_seconds_with_tool / s.median_seconds_with_nasa_pdfs) * 100) : null;
  return (
    <div className="explorer-page mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <h1 className="display text-3xl">Who this helps, and what we have measured so far</h1>
      <p className="mt-3 text-muted max-w-[75ch]">Everything on this page is either sourced, or marked "not measured yet". We do not claim lives saved.</p>

      <section className="mt-10" aria-labelledby="who">
        <h2 id="who" className="display text-2xl">Who benefits</h2>
        <ul className="mt-4" style={{ display: "grid", gap: 14 }}>
          {AUDIENCES.map((a) => (
            <li key={a.who} style={{ borderTop: "1px solid rgba(128,128,128,.35)", paddingTop: 10 }}>
              <h3 className="display text-lg"><a href={a.href} style={{ textDecoration: "underline" }}>{a.who}</a></h3>
              <p className="text-muted max-w-[75ch]">{a.gets}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="measure">
        <h2 id="measure" className="display text-2xl">Measured outcome: time to a trustworthy answer</h2>
        <p className="mt-2 text-muted max-w-[75ch]">Task: "{s.question}" People answer once from NASA's PDFs and once with this tool. Results appear here when they are entered in <code>data/impact/impact.json</code>.</p>
        <dl className="mt-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <div><dt className="text-muted text-sm">People tested</dt><dd className="display text-xl">{s.participants ?? "not measured yet"}</dd></div>
          <div><dt className="text-muted text-sm">Median time, NASA PDFs</dt><dd className="display text-xl">{fmt(s.median_seconds_with_nasa_pdfs, "s")}</dd></div>
          <div><dt className="text-muted text-sm">Median time, this tool</dt><dd className="display text-xl">{fmt(s.median_seconds_with_tool, "s")}</dd></div>
          <div><dt className="text-muted text-sm">Difference</dt><dd className="display text-xl">{faster === null ? "not measured yet" : `${faster}% faster`}</dd></div>
        </dl>
      </section>

      <section className="mt-12" aria-labelledby="bangladesh">
        <h2 id="bangladesh" className="display text-2xl">Bangladesh: where the method applies</h2>
        <p className="mt-2 text-muted max-w-[75ch]">
          Our NASA data is about microgravity, so it says nothing about these buildings. What carries over is the method: before applying a test result,
          check that it covered your conditions, and name the data that is missing. Fire Service and Civil Defence counts for {b.year}:
        </p>
        <dl className="mt-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {b.headline.map((h) => (<div key={h.label}><dt className="text-muted text-sm">{h.label}</dt><dd className="display text-2xl">{h.value}</dd><p className="text-muted text-sm">{h.note}</p></div>))}
        </dl>
        <table className="mt-6" style={{ width: "100%", maxWidth: 720, borderCollapse: "collapse" }}>
          <caption className="text-muted text-sm" style={{ textAlign: "left" }}>Fires by place, {b.year}</caption>
          <tbody>
            {b.places.map((p) => (
              <tr key={p.place} style={{ borderTop: "1px solid rgba(128,128,128,.3)" }}>
                <th scope="row" style={{ textAlign: "left", padding: 6, width: "34%" }}>{p.place}</th>
                <td style={{ padding: 6 }}><div role="img" aria-label={`${p.fires} fires`} style={{ height: 10, width: `${(p.fires / max) * 100}%`, minWidth: 3, background: "currentColor", opacity: 0.7, borderRadius: 2 }} /></td>
                <td style={{ padding: 6, textAlign: "right" }}>{p.fires.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 max-w-[75ch]"><strong>The gap this shows.</strong> The counts say where fires happen, but not what conditions the buildings were in (exits, materials, ventilation, load). A "will it burn" check for a Bangladeshi building needs that table, and nobody has published it with the counts. That missing table is the same kind of gap our atlas finds in NASA's data.</p>
        <ul className="mt-4" style={{ display: "grid", gap: 8 }}>
          {b.cases.map((c) => (<li key={c.name} className="text-sm max-w-[75ch]"><strong>{c.name}.</strong> {c.fact} <a href={c.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>source</a></li>))}
        </ul>
        <p className="mt-3 text-muted text-sm">Sources: {b.sources.map((x, i) => (<span key={x.url}>{i > 0 && "; "}<a href={x.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{x.label}</a></span>))}. Counts come from news reports of the Fire Service release; confirm against the release before citing.</p>
      </section>

      <section className="mt-12" aria-labelledby="adopt">
        <h2 id="adopt" className="display text-2xl">Who has looked at it</h2>
        {impact.adopters.length === 0
          ? <p className="mt-2 text-muted max-w-[75ch]">No outside reviewer has responded yet. We have asked researchers, a Bangladeshi fire-safety lecturer and the Fire Service; replies will be listed here with their permission.</p>
          : <ul className="mt-3" style={{ display: "grid", gap: 10 }}>{(impact.adopters as { name: string; role: string; said: string }[]).map((a) => (<li key={a.name}><q>{a.said}</q> <span className="text-muted text-sm">{a.name}, {a.role}</span></li>))}</ul>}
      </section>

      <section className="mt-12" aria-labelledby="build">
        <h2 id="build" className="display text-2xl">Build on it</h2>
        <ul className="mt-2 text-muted max-w-[75ch]" style={{ listStyle: "disc", paddingLeft: 20 }}>
          <li>Data and cited rows: <a href="/downloads" style={{ textDecoration: "underline" }}>downloads</a>. Add a row with a citation, then retrain (<code>docs/ADD_DATA.md</code>).</li>
          <li>Agents: <code>.mcp.json</code> registers the evidence server; five tools, no model calls in the science code.</li>
          <li>Another dataset: the strict check needs only a table of conditions and outcomes with page-level sources.</li>
        </ul>
      </section>
    </div>
  );
}
