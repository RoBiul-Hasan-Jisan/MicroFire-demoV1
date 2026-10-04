// Will It Burn? page state with no DOM in it, so Node tests run the same code the browser runs.
// It decides nothing scientific: it turns taps into request params, keeps requests in order, and keeps
// each answer tied to the question it actually answers.

/** The scenario the server answered, as explicit params. Only what was actually set travels back. */
export function paramsFrom(s) {
  const p = { mission: s.mission.id, material: s.material.id, air: s.air.preset,
    thickness: s.thickness ?? 'all', width: s.width ?? 'all', airflow: s.airflow ?? 'none' };
  if (s.mission.id === 'other') { p.place = s.mission.name; if (s.mission.g !== null && s.mission.g !== undefined) p.g = s.mission.g; }
  if (s.material.id === 'other') p.materialName = s.material.inline;
  if (s.air.explicitO2) p.o2 = s.air.o2;
  if (s.air.explicitPsi) p.psi = s.air.psi;
  return p;
}

/**
 * What a tap builds on. An Unclear answer's scenario isn't trusted, because the question behind it wasn't read, so
 * the tap sends that question again: its unreadable parts stay unanswered unless the tap replaces them (FR-20).
 */
export function baseFrom(answered) {
  if (!answered) return null;
  return answered.verdict?.state === 'unresolved' ? { q: answered.canonical } : paramsFrom(answered.scenario);
}

/** The question an answer answers: the one typed, or after a tap the canonical question the box now shows. */
export const askedFor = (data, meta) => meta.kind === 'question' ? meta.question : data.canonical;

/** A tap changes one field of the intended scenario and keeps the rest. */
export function applyPatch(base, patch) {
  const p = { ...base, ...patch };
  if ('air' in patch || 'mission' in patch) { delete p.o2; delete p.psi; }
  if ('mission' in patch && !('air' in patch)) delete p.air;   // a new mission brings its own default air
  if ('mission' in patch && patch.mission !== 'other') { delete p.place; delete p.g; }
  if ('material' in patch && patch.material !== 'other') delete p.materialName;
  return p;
}

/**
 * Sends questions and taps in order. The newest intent always wins: a reply that arrives after a newer request
 * is dropped, and each tap builds on the newest intended scenario, not on the last reply. A tap made while a
 * typed question is still being read waits for it, so the tap applies to what was actually asked.
 */
export function createController({ request, onAnswer, onError, onBusy = () => {} }) {
  let version = 0, answered = null, intended = null, reading = false, queued = null;

  async function send(params, meta) {
    const v = ++version;
    onBusy(true, meta);
    try {
      const data = await request(params);
      if (v !== version) return;
      if (meta.kind === 'question') reading = false;
      answered = data;
      // Once a tap has answered an Unclear question, later taps build on what was answered, as they do everywhere else.
      if (meta.kind === 'tap' && intended?.q !== undefined && data.verdict?.state !== 'unresolved') intended = paramsFrom(data.scenario);
      if (queued) { const patch = queued; queued = null; return await change(patch); }
      onAnswer(data, meta);
    } catch (error) {
      if (v !== version) return;
      if (meta.kind === 'question') { reading = false; queued = null; }
      onError(error, meta);
    } finally {
      if (v === version) onBusy(false, meta);
    }
  }

  function ask(question) {
    intended = null; queued = null; reading = true;
    return send({ q: question }, { kind: 'question', question });
  }

  function change(patch) {
    if (reading) { queued = { ...queued, ...patch }; return Promise.resolve(); }
    const base = intended ?? baseFrom(answered);
    if (!base) return Promise.resolve();
    intended = applyPatch(base, patch);
    return send(intended, { kind: 'tap', params: intended });
  }

  return { ask, change, get answered() { return answered; }, get intended() { return intended; } };
}

const ONE_SIXTH = 0.166;
/** How the verdict card draws an answer. Only matched evidence gets a confident flame. */
export function verdictView(r) {
  const state = r.verdict.state, m = r.scenario.mission, g = m.g;
  const evidence = state === 'burned' || state === 'mixed';
  const caption = state === 'no-burn' ? 'No flame held on this material in NASA’s tries, so the sample is drawn without one.'
    : state === 'unresolved' ? 'The question couldn’t be read, so the flame is only a dashed outline.'
    : evidence ? 'In orbit nothing rises. Oxygen reaches the flame only by slow diffusion and airflow, so it rounds out, dims and turns blue. Earth’s teardrop flame is shown small for comparison.'
    : g === 0 ? 'No test matches this cabin, so the flame is only a dashed outline. This app doesn’t draw what NASA didn’t observe.'
    : m.id === 'earth' ? 'On Earth, hot gas rises and flames stretch upward. These tests never ran at Earth’s gravity, so the outline is dashed.'
    : m.id === 'moon' || m.id === 'mars' ? `At ${g === ONE_SIXTH ? '1/6' : '0.38'} of Earth’s gravity some hot gas still rises. How a flame spreads here is barely tested, so the outline is dashed.`
    : `These tests never ran ${m.phrase}, so the outline is dashed.`;
  return {
    stampClass: { burned: 'burn', mixed: 'mixed', 'no-burn': 'held', unresolved: 'unclear' }[state] ?? 'gap',
    flame: { g: g ?? 1, known: evidence && g === 0, lit: state !== 'no-burn' },
    shapeNote: !(evidence && g === 0),
    caption
  };
}
