"use client";
/* eslint-disable @next/next/no-img-element -- next/image writes inline style attributes, which the strict CSP blocks */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CinematicWorld, type World } from "@/components/world/CinematicWorld";
import { EvidenceConstellation } from "@/components/world/EvidenceConstellation";
import { FlameVision } from "@/components/FlameVision";
import { AskPanel } from "@/components/AskPanel";
import { Cite } from "@/components/Cite";
import { useExplorer } from "@/components/guide/EmberGuide";
import { useSound } from "./sound";
import { evidenceRecords, experiments, getExperiment } from "@/lib/data";
import { ladder } from "@/lib/ontology";
import { LadderGame, MOON_Q } from "./LadderGame";
import { getMedia, MEDIA_CONTEXT, type FrameMetrics } from "@/lib/media";
import { CHANGES, distractors, hop, restoreJourney, JOURNEY_FILMS as FILMS, JOURNEY_TASKS as TASKS, LOG_MAX, RANKS, type Change } from "@/lib/expedition";
import { saveCertificate } from "./certificate";
import { CREW, type CrewId } from "@/lib/guide";
import styles from "./EvidenceExpedition.module.css";

const STEPS: { name: string; title: string; line: string; crew: CrewId; world: World }[] = [
  { name: "Welcome", title: "Follow a spark. Find a story.", line: "A flame in space has a story to tell. You are the detective. Let's find the evidence together.", crew: "tala", world: "portal" },
  { name: "Choose", title: "Which flame catches your eye?", line: "These are real NASA experiments. Choose a film to bring into our observation room.", crew: "kofi", world: "lab" },
  { name: "Look closely", title: "What can a computer see?", line: "Play the film. Turn on AI vision, then tap a measurement to light up its guide.", crew: "kofi", world: "bay" },
  { name: "Trace", title: "Put your detective eyes to work.", line: "Which outline follows this NASA flame photograph? Compare the edges, then check what the computer traced.", crew: "mei", world: "bay" },
  { name: "Compare", title: "One change. A different clue.", line: "Start with B20. Choose a condition to change, then open the crew's record of another real test.", crew: "mei", world: "constellation" },
  { name: "Moon mission", title: "Take your clues to the Moon.", line: "A Moon base might use 34% oxygen at 56.5 kPa. Sort these clues onto the Evidence Ladder: how close can real NASA tests get?", crew: "tala", world: "moonlab" },
  { name: "The unknown", title: "A missing star is a question.", line: "Our atlas contains tests made in orbit. Can they answer the same question for the Moon?", crew: "mei", world: "starfield" },
  { name: "Ask PIX", title: "Good scientists ask why.", line: "Ask about the tests you explored. PIX retrieves NASA evidence. Open a source and check the answer.", crew: "mei", world: "constellation" },
  { name: "Your discoveries", title: "You followed the evidence.", line: "You made choices, looked closely, and kept the questions that still need answers. That is how scientists learn.", crew: "tala", world: "constellation" },
];
const TITLES: Record<string, string> = { watch: "Flame observer", trace: "Outline detective", compare: "Evidence comparer", moon: "Moon investigator", gap: "Question finder", ask: "Source seeker" };
/** PIX's tap-for-a-hint lines, one per chapter: a nudge toward the task, never the answer. */
const HINTS = [
  "Tap the big button and I'll come with you!",
  "Both films are real NASA videos. Pick the one that makes you most curious.",
  "Switch on AI vision, then tap a measurement. I light up what I measured.",
  "Look at the bright edge of the flame. Which outline hugs it best?",
  "Change one thing about test B20, then predict before you peek!",
  "Saffire is close, but not exact. Droplets explain how fire works. And one card is a test nobody has done yet!",
  "Can a missing test prove something is safe? Think like a scientist.",
  "Tap a suggested question, then open a source to check my answer.",
  "Save your certificate, or visit a chapter again to find a missing clue.",
];
const CHEERS = ["Clue saved! You're thinking like a scientist.", "Great eyes! That one goes in the notebook.", "Brilliant! Evidence first, then ideas.", "Yes! Checking is what scientists do.", "Another star lit! Keep going.", "You did it! Every clue found."];
const BASE = getExperiment("bass2-B20")!;
const PHOTO = getMedia("bass2-reduced-o2-gmt213")!;
const KEY = "microfire-spark-journey-v1";

export function EvidenceExpedition({ trace }: { trace: FrameMetrics }) {
  const { gentle, setGentle, discover } = useExplorer();
  const sound = useSound();
  const [step, setStep] = useState(0);
  const [film, setFilm] = useState(FILMS[0]);
  const [done, setDone] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [change, setChange] = useState<Change | null>(null);
  const [gap, setGap] = useState<number | null>(null);
  const [notes, setNotes] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [nick, setNick] = useState("");
  const [predict, setPredict] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [reward, setReward] = useState<{ n: number; title: string } | null>(null);
  const [pixLine, setPixLine] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const scene = STEPS[step];
  const item = getMedia(film)!;
  const result = change ? hop(BASE, change, experiments) : null;
  const moonGaps = useMemo(() => ladder(evidenceRecords, [], MOON_Q).gaps.map((g) => g.text), []);
  const outlines = distractors(trace.outlines[0]);
  const options = [outlines.shifted, trace.outlines[0], outlines.scaled];

  useEffect(() => {
    try {
      const saved = restoreJourney(localStorage.getItem(KEY));
      /* eslint-disable react-hooks/set-state-in-effect -- restore a bounded local save once */
      setStep(saved.step); setFilm(saved.film); setDone(saved.done); setLog(saved.log); setNick(saved.nick);
    } catch { /* A missing or malformed save starts a new adventure. */ }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (ready) { try { localStorage.setItem(KEY, JSON.stringify({ step, film, done, log, nick })); } catch { /* Still playable without storage. */ } }
  }, [step, film, done, log, nick, ready]);
  useEffect(() => { if (notes) dialog.current?.showModal(); else dialog.current?.close(); }, [notes]);
  useEffect(() => {
    if (!reward) return;
    const t = setTimeout(() => { setReward(null); setPixLine((l) => (l && CHEERS.includes(l) ? null : l)); }, 2600);
    return () => clearTimeout(t);
  }, [reward]);
  /** Every clue is earned by an action; the log line says exactly what the child did. */
  function earn(id: string, discovery?: string, line?: string) {
    if (line) setLog((old) => old[old.length - 1] === line ? old : [...old, line].slice(-LOG_MAX));
    if (discovery) discover(discovery);
    if (done.includes(id)) return;
    const n = done.length + 1;
    setDone([...done, id]);
    setReward({ n, title: TITLES[id] });
    setPixLine(CHEERS[n % CHEERS.length]);
    sound.play(n === TASKS.length ? "fanfare" : "right");
  }
  function go(n: number) {
    setStep(n); setPixLine(null); sound.play("whoosh");
    requestAnimationFrame(() => { title.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); });
  }
  const complete = step < 2 || step === 8 || done.includes(TASKS[step - 2]);
  // The guide reacts: cheers when a clue is found, thinks while a task is open, points on once it is done.
  const pose: "default" | "cheering" | "thinking" | "pointing" = reward ? "cheering" : step === 0 || step === 8 ? "default" : complete ? "pointing" : "thinking";
  return <section className={styles.expedition}>
    <div className={styles.backdrop}><CinematicWorld world={scene.world} priority /></div>
    <header className={styles.toolbar}>
      <Link href="/" className={styles.brand}>✦ Follow the Spark</Link>
      <div className={styles.meter} role="img" aria-label={`${done.length} of ${TASKS.length} clues found. Rank: ${RANKS[done.length]}`}>
        <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" className={styles.meterTrack} /><circle cx="18" cy="18" r="15" className={styles.meterFill} strokeDasharray={`${(done.length / TASKS.length) * 94.2} 94.2`} /></svg>
        <b>{done.length}/{TASKS.length}</b><span>{RANKS[done.length]}</span>
      </div>
      <div><button onClick={() => setGentle(!gentle)} aria-pressed={gentle}>{gentle ? "Motion paused" : "Pause motion"}</button><button onClick={() => sound.setOn(!sound.on)} aria-pressed={sound.on}>{sound.on ? "Sound on" : "Sound off"}</button><button onClick={() => setNotes(true)}>Science notes</button></div>
    </header>
    <nav className={styles.path} aria-label="Adventure chapters">{STEPS.map((s, i) => <button key={s.name} aria-current={step === i ? "step" : undefined} onClick={() => go(i)}><span>{i > 1 && i < 8 && done.includes(TASKS[i - 2]) ? "✓" : i + 1}</span>{s.name}</button>)}</nav>
    <div className={`${styles.layout} ${step === 0 || step === 8 ? styles.bookend : ""}`}>
      <aside className={styles.crew}>
        <div className={styles.actor} key={scene.crew}>
          <img key={pose} src={pose === "default" ? CREW[scene.crew].img : CREW[scene.crew].poses[pose]} alt={`${CREW[scene.crew].name}, your guide${pose === "default" ? "" : `, ${pose}`}`} />
          <span className={styles.crewOrbit} aria-hidden="true" />
        </div>
        <div className={styles.dialogue} key={step}><strong>{CREW[scene.crew].name}</strong><p>{scene.line}</p><small>{complete && step > 1 && step < 8 ? "Clue saved to your journey" : "Take your time. Try things out."}</small></div>
        <p className={styles.artLabel}>Characters and scenery are illustrations.</p>
      </aside>
      <div className={styles.work}>
        <div className={styles.heading}><p>Chapter {step + 1} of {STEPS.length} · {scene.name}</p><h1 ref={title} tabIndex={-1} className="display">{scene.title}</h1></div>
        <div key={step} className={styles.scene}>
          {step === 0 && <div className={styles.welcome}>
            <div className={styles.robot}><img src="/art/pix.webp" alt="PIX, your floating evidence companion" width={220} height={183} /><span>Meet PIX</span></div>
            <p>Six discoveries. Real NASA evidence. One curious explorer: you.</p>
            <button className="story-cta" onClick={() => go(1)}>Let’s follow the spark <span aria-hidden="true">↗</span></button>
            <Link href="/story" className={styles.secondary}>Or build the 3D wind tunnel first</Link>
            {done.length > 0 && <p className={styles.saved}>Your notebook has {done.length} saved discoveries. Visit any chapter above.</p>}
          </div>}
          {step === 1 && <div className={styles.films}>{FILMS.map((slug, i) => <button key={slug} onClick={() => { setFilm(slug); discover("realflame"); go(2); }} className={styles.film}>
            <img src={`/media/${slug}/poster.jpg`} width={640} height={466} alt={MEDIA_CONTEXT[slug].label} loading="lazy" />
            <span className={styles.play}>▶</span><div><small>Real NASA video · {i === 0 ? "Saffire-V" : "Saffire-VI"}</small><h2 className="display">{i === 0 ? "A flame finds the thin ribs" : "Watch a flame spread"}</h2><p>{i === 0 ? "Can you spot where the flame advances?" : "What changes as the film moves?"}</p><b>Investigate this flame ↗</b></div>
          </button>)}</div>}
          {step === 2 && <div className={styles.lab}>
            <FlameVision key={film} item={item} initialMode="raw" compact onInspect={() => earn("watch", "aivision", `Measured a real NASA flame with AI vision: ${MEDIA_CONTEXT[film].label}`)} />
            <a className={styles.source} href={item.page_url} target="_blank" rel="noreferrer">NASA source: {MEDIA_CONTEXT[film].label} ↗</a>
            <p className={styles.note}>This Saffire film is not linked to the BASS-II table rows used later. Their conditions cannot be assigned to this footage.</p>
          </div>}
          {step === 3 && <div className={styles.trace}>
            <div className={styles.photo}>
              <img src={`/media/${PHOTO.slug}/image.jpg`} alt="Real BASS-II flame photographed aboard the ISS" />
              {choice != null && <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><polygon points={options[choice].map(p => p.join(',')).join(' ')} fill="#6ce4f233" stroke="#8eeaf5" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}
              <span>Real NASA photograph · BASS-II</span>
            </div>
            <div className={styles.traceOptions}>{options.map((outline, i) => <button key={i} aria-pressed={choice === i} onClick={() => { setChoice(i); const t = tries + 1; setTries(t); if (i === 1) earn("trace", "aivision", `Found the computer's outline on try ${t}`); else sound.play("wrong"); }}><svg viewBox="0.48 0.25 0.44 0.6" aria-hidden="true"><polygon points={outline.map(p => p.join(',')).join(' ')} fill="#5ac9e520" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><span>Outline {String.fromCharCode(65 + i)}</span></button>)}</div>
            <p className={styles.feedback} role="status">{choice == null ? "Tap an outline to lay it over the photo." : choice === 1 ? "Nice spotting! B is the largest region traced by our computer-vision pipeline." : "Look closely at the edges. This practice outline is shifted or resized. Try another."}</p>
            <p className={styles.note}>Two outlines are made-up practice choices. The real outline is an algorithm’s estimate, not a hand-verified perfect boundary. This photograph is not tied to one test row.</p>
            <a href={PHOTO.page_url} target="_blank" rel="noreferrer" className={styles.source}>Open the original NASA photograph ↗</a>
          </div>}
          {step === 4 && <div className={styles.comparison}>
            <Record record={BASE} />
            <div className={styles.choices} aria-label="Change a recorded condition">{CHANGES.map(c => <button key={c.id} aria-pressed={change === c.id} onClick={() => { setChange(c.id); setPredict(null); const h = hop(BASE, c.id, experiments); if (h.kind === "gap") earn("compare", undefined, `Changed ${c.label.toLowerCase()} from B20 and found a science gap`); else sound.play("tick"); }}>{c.label}</button>)}</div>
            {result && (result.kind === "gap" ? <div className={styles.gapResult}><span>?</span><h2 className="display">We found a question!</h2><p>{result.reason}</p><p>Other partial-gravity studies exist; this gap describes our collection.</p></div> : <><p className={styles.feedback}>{result.kind === "matched" ? `A comparable record was found: test ${result.to.test_id}.` : `Closest record: test ${result.to.test_id}. ${result.differs.join('; ')}. More than one condition differs.`}</p>
              {predict == null ? <div className={styles.predict}><p><strong>Predict first!</strong> What do you think NASA recorded for test {result.to.test_id}?</p><div className={styles.choices}>{["It kept burning", "It went out"].map((label, i) => <button key={label} onClick={() => {
                const burning = result.to.outcome_group === "sustained";
                const right = (i === 0) === burning;
                setPredict(i); if (!right) sound.play("wrong");
                earn("compare", "hop", `Predicted test ${result.to.test_id} ${i === 0 ? "kept burning" : "went out"}: ${right ? "matched the record" : "the record said otherwise"}`);
              }}>{label}</button>)}</div></div>
              : <><p className={styles.feedback} role="status"><strong>{(predict === 0) === (result.to.outcome_group === "sustained") ? "Your prediction matched the record!" : "Surprise! The record says something different. That is why scientists check."}</strong></p><Record record={result.to} /></>}
              <p className={styles.note}>These are recorded outcomes, not generated flame predictions. Similar conditions alone do not prove cause.</p></>)}
          </div>}
          {step === 5 && <div className={styles.moon}>
            <div className={styles.scenario}><span>Research scenario · Moon gravity · PMMA</span><strong>34% O₂ <i>at</i> 56.5 kPa</strong><p>Oxygen percentage and pressure describe different things.</p><Cite sourceId="exploration-atmosphere" /></div>
            <LadderGame
              onTry={(right) => sound.play(right ? "tick" : "wrong")}
              onDone={(tries) => earn("moon", "moonmatch", `Sorted the Moon-base clues onto the Evidence Ladder in ${tries} tries`)}
            />
          </div>}
          {step === 6 && <div className={styles.unknown}>
            <div className={styles.questionSky} aria-hidden="true"><i /><i /><i /><i /><i /><span>?</span></div>
            <h2 className="display">What should our notebook say?</h2>
            <div className={styles.answers}>{["The habitat must be safe.", "We need more evidence for these conditions.", "Fire cannot burn on the Moon."].map((answer, i) => <button key={answer} aria-pressed={gap === i} onClick={() => { setGap(i); if (i === 1) earn("gap", "edge", "Wrote in the notebook: we need more evidence for Moon conditions"); else sound.play("wrong"); }}>{answer}</button>)}</div>
            {gap != null && <p className={styles.feedback} role="status">{gap === 1 ? "Exactly. A missing match is an open research question. Our collection cannot settle it." : "A gap cannot prove that something is safe or impossible. What evidence would we still need?"}</p>}
            <details className={styles.notes}><summary>Which conditions are missing?</summary><ul>{moonGaps.map(x => <li key={x}>{x}</li>)}</ul><Link href="/gaps" className={styles.source}>Explore the full evidence map ↗</Link></details>
          </div>}
          {step === 7 && <div className={styles.ask}><AskPanel onAnswered={() => earn("ask", "askpix", "Asked PIX a question and checked the NASA sources")} /></div>}
          {step === 8 && <div className={styles.finale}>
            <EvidenceConstellation />
            <div className={styles.badges}>{TASKS.map(id => <div key={id} data-earned={done.includes(id)}><span>{done.includes(id) ? "✦" : "○"}</span><strong>{TITLES[id]}</strong><small>{done.includes(id) ? "Discovered" : "Still to explore"}</small></div>)}</div>
            <p>{done.length === TASKS.length ? "Your six discoveries are complete. What will you investigate next?" : `${done.length} of six discoveries saved. Every chapter stays open so you can keep exploring.`}</p>
            <div className={styles.debrief}>
              <div><small>Your rank</small><strong className="display">{RANKS[done.length]}</strong></div>
              <h2>What you actually did</h2>
              {log.length ? <ol>{log.map((l, i) => <li key={i}>{l}</li>)}</ol> : <p>Your actions will appear here as you explore each chapter.</p>}
              <label>Nickname for your certificate (optional, stays on this device)<input value={nick} maxLength={30} onChange={(e) => setNick(e.target.value)} /></label>
              <button className="story-cta" onClick={() => { void saveCertificate({ nick, rank: RANKS[done.length], clues: TASKS.filter((t) => done.includes(t)).map((t) => TITLES[t]), log }); sound.play("fanfare"); }}>Save my certificate ↓</button>
            </div>
            <div className={styles.choices}><button onClick={() => go(1)}>Explore another flame</button><Link href="/story">Build the 3D experiment</Link><button onClick={() => setNotes(true)}>Open science notes</button></div>
          </div>}
        </div>
        {step > 0 && <div className={`${styles.companion} ${reward ? styles.cheer : ""}`} key={reward?.n ?? "pix"}>
          {pixLine && <p className={styles.pixBubble} role="status">{pixLine}</p>}
          <button onClick={() => { setPixLine(pixLine === HINTS[step] ? null : HINTS[step]); sound.play("tick"); }} aria-label={pixLine === HINTS[step] ? "Hide PIX's hint" : "Ask PIX for a hint"}>
            <img src="/art/pix.webp" alt="" width={96} height={80} /><span>Hint</span>
          </button>
        </div>}
        {step > 0 && step < 8 && <footer className={styles.navigation}><button onClick={() => go(step - 1)}>← Back</button><span>{complete ? "Ready for the next discovery" : "Explore here, or return anytime"}</span><button className="story-cta" onClick={() => go(step + 1)}>{complete ? step === 7 ? "See my discoveries" : "Next discovery" : "Explore next chapter"} →</button></footer>}
      </div>
    </div>
    {reward && <div className={styles.reward} role="status" key={reward.n}>
      <div className={styles.burst} aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
      <small>Clue {reward.n} of {TASKS.length} found</small><strong>{reward.title}</strong>
      {RANKS[reward.n] !== RANKS[reward.n - 1] && <span>New rank: {RANKS[reward.n]}</span>}
    </div>}
    <dialog ref={dialog} className={styles.notebook} onCancel={() => setNotes(false)} onClose={() => setNotes(false)} aria-labelledby="spark-notes-title"><button className={styles.close} onClick={() => setNotes(false)} aria-label="Close science notes">×</button><h2 id="spark-notes-title" className="display">Our science notebook</h2><p>Scenery and characters are fantasy illustrations. NASA footage, test records, and source quotations are evidence.</p><h3>Your selected film</h3><p>{MEDIA_CONTEXT[film].label}</p><p>{MEDIA_CONTEXT[film].unknown}</p><a className={styles.source} href={item.page_url} target="_blank" rel="noreferrer">NASA film source ↗</a><h3>What the computer measured</h3><p>Classical OpenCV segmentation detects bright warm and blue pixels inside a documented region. Width, height, and area remain in image pixels. This is not a trained fire-prediction model.</p><h3>How records are compared</h3><p>Material, oxygen, flow, pressure and gravity remain separate. Missing variables contribute zero similarity and lower coverage. A close match never certifies a habitat.</p><Link href="/methodology" className={styles.source}>Full method, weights and limitations ↗</Link><h3>Your journey</h3><p>{done.length} discoveries saved in this browser. No account needed.</p><button className="game-btn" onClick={() => { setDone([]); setLog([]); setTries(0); setPredict(null); setChoice(null); setChange(null); setGap(null); setNotes(false); go(0); }}>Start this journey again</button></dialog>
  </section>;
}

function Record({ record }: { record: typeof BASE }) {
  return <article className={styles.record}><header><span>NASA BASS-II · recorded test</span><strong>{record.test_id}</strong></header><dl><div><dt>Material</dt><dd>{record.material}</dd></div><div><dt>Oxygen</dt><dd>{record.oxygen_vol_pct}%</dd></div><div><dt>Starting airflow</dt><dd>{record.flow_initial_cm_s} cm/s</dd></div></dl><p className={styles.outcome}>{record.outcome_label}</p><blockquote>“{record.observations_verbatim}”</blockquote><Cite sourceId={record.provenance.record.source_id} page={record.provenance.record.pdf_page} where="Test table" /></article>;
}
