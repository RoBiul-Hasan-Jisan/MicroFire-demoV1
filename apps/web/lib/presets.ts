/**
 * Curated comparisons. Each one holds as many conditions constant as the NASA tables allow,
 * and separates what was recorded from what we read into it.
 */
export type Preset = {
  id: string;
  title: string;
  question: string;
  ids: string[];
  varies: string;
  observed: string[];
  interpretation: string;
  gaps: string[];
  findings: string[];
};

export const PRESETS: Preset[] = [
  {
    id: "pmma-flow-window",
    title: "Same thin PMMA film, near-identical oxygen, different airflow",
    question: "What changed across these near-matched PMMA tests as airflow changed?",
    ids: ["bass2-B16", "bass2-B20", "bass2-B19"],
    varies: "Airflow",
    observed: [
      "All three are 2-cm-wide, 100-µm PMMA films in opposed flow, run on the same listed date at 16.4–16.5 % oxygen.",
      "B16 started at 3 cm/s; NASA notes the flame quenched after a prolonged burn once the fan was turned down to a 0.4 setting.",
      "B20 ran at 5 then 3 cm/s, then a 0.5 fan setting; NASA notes the flame burned the entire sample.",
      "B19 ran at 10 cm/s and NASA notes the flame blew out.",
    ],
    interpretation:
      "The near-matched runs associate different airflow histories with different outcomes. B16 and B20 report 16.5 % oxygen; B19 reports 16.4 %, a difference of 0.1 percentage point. This pattern is consistent with limits reported for other PMMA geometries, but these isolated runs do not prove airflow caused the difference or locate a boundary.",
    gaps: [
      "The flows at which B16 quenched and B19 blew out are recorded only as fan settings, not cm/s.",
      "One run per condition, so run-to-run scatter is unknown.",
    ],
    findings: ["pmma-rod-limits", "quench-mechanism", "low-flow-sensitivity"],
  },
  {
    id: "pmma-oxygen-at-10",
    title: "Same film, same airflow, different oxygen",
    question: "At 10 cm/s, does a few percent less oxygen change whether a thin PMMA flame survives?",
    ids: ["bass2-B15", "bass2-B19"],
    varies: "Oxygen",
    observed: [
      "Both are 2-cm-wide, 0.1-mm PMMA films in opposed flow at 10 cm/s.",
      "B15 at 20.1 % oxygen: “Spread at 10 cm/s, did not blowoff”.",
      "B19 at 16.4 % oxygen: “flame blew out at a pot of 6.0”.",
    ],
    interpretation:
      "The lower-oxygen run recorded blowoff, while the near-normal-oxygen run recorded continued spread. This association is consistent with NASA's PMMA rod work, but two isolated runs do not establish oxygen as the sole cause.",
    gaps: ["B19's exact blowoff flow is a fan setting, not cm/s.", "No intermediate oxygen levels at this flow in the table."],
    findings: ["pmma-rod-limits"],
  },
  {
    id: "sibal-quench-vs-oxygen",
    title: "Where fabric flames quenched, by oxygen level",
    question: "As oxygen drops, does a fabric flame need more airflow to stay alight?",
    ids: ["sibal-GMT45-T4", "sibal-GMT100-T13", "sibal-GMT175-T18", "sibal-GMT178-T14"],
    varies: "Oxygen",
    observed: [
      "All four are 2.2-cm-wide SIBAL cotton–fiberglass fabric in concurrent flow; in each, the crew turned the flow down until the flame quenched.",
      "Final flow when quenched: 2.2 cm/s at 18.7 % O₂, 2.2 at 17.5 %, 2.6 at 17.4 %, 2.8 at 16.9 %.",
    ],
    interpretation:
      "The flame went out at a slightly higher flow as oxygen fell. NASA's own analysis of these tests reports the same trend: quenching speeds between 1 and 5 cm/s, higher in lower oxygen.",
    gaps: [
      "The final flow is where the test ended, which bounds the quenching speed rather than measuring it exactly.",
      "No tests below 16.9 % oxygen quenched in this set; at 16.4 % the sample did not ignite.",
    ],
    findings: ["sibal-quench-speeds", "sibal-first-boundary"],
  },
  {
    id: "sibal-flow-at-21",
    title: "Fabric at normal oxygen, 10 versus 5 cm/s",
    question: "How does halving the airflow change a fabric flame at 21 % oxygen?",
    ids: ["sibal-GMT96-T7", "sibal-GMT96-T8"],
    varies: "Airflow",
    observed: [
      "Both are 2.2-cm-wide SIBAL fabric at 21 % oxygen in concurrent flow, from the original BASS experiment.",
      "NASA reports the 10 cm/s burn took about 40 s; the 5 cm/s burn took more than 60 s, with a shorter flame that spread more slowly.",
    ],
    interpretation:
      "NASA reported slower spread in the lower-flow fabric test. That result does not establish a universal ventilation rule for cabins; other NASA observations include dim flames persisting at very low flow.",
    gaps: ["Spread rates are given in a figure, not a table, so we do not transcribe numeric values."],
    findings: ["sibal-10-vs-5", "sibal-10-duration", "sibal-5-duration", "sibal-spread-trends"],
  },
  {
    id: "materials-near-21",
    title: "Three materials near normal oxygen",
    question: "At about 21 % oxygen and 10 cm/s, which materials kept burning?",
    ids: ["bass2-F1", "sibal-GMT96-T7", "bass2-B15"],
    varies: "Material (and flow direction)",
    observed: [
      "Nomex (F1, 20.6 % O₂, 9.5 cm/s concurrent): “Ignited briefly but did not spread at all and extinguished while the igniter was still on”.",
      "SIBAL fabric (GMT96-T7, 21 %, 10 cm/s concurrent): NASA describes a burn under exactly these conditions taking about 40 s.",
      "PMMA film (B15, 20.1 %, 10 cm/s opposed): “Spread at 10 cm/s, did not blowoff”.",
    ],
    interpretation:
      "Under similar oxygen and flow, Nomex did not sustain a flame while the fabric and PMMA did. The geometries and flow directions differ, so this is a material contrast to explore, not a controlled ranking.",
    gaps: ["Nomex thickness is not stated in the table.", "PMMA was tested in opposed flow, the others in concurrent flow."],
    findings: [],
  },
  {
    id: "saffire-habitat-air",
    title: "Same fabric, sea-level air vs Moon-like air",
    question: "When Saffire lowered the pressure and raised the oxygen, how did the same fabric's recorded burn differ?",
    ids: ["saffire-iv-1", "saffire-vi-2"],
    varies: "Pressure and oxygen, together",
    observed: [
      "Both are 50-cm SIBAL fabric samples in 20 cm/s concurrent flow, burned inside an uncrewed Cygnus cargo ship.",
      "IV-1 ran at 100.0 kPa and 22.0 % oxygen. NASA's Table 2 gives a 130 s burn and a 3,150 W average heat release (fuel-consumption calorimetry).",
      "VI-2 ran at 54.1 kPa and 31.0 % oxygen. Table 2 gives a 112 s burn, a 3,650 W average and a 3,217 W peak. NASA: “The SIBAL sample (left image) achieved a steady size and spread rate quite rapidly”.",
    ],
    interpretation:
      "In the lower-pressure, higher-oxygen air the same fabric burned for a shorter time with a higher average heat release. Pressure and oxygen changed together, so this pair cannot separate their effects, and one run at each atmosphere cannot show scatter.",
    gaps: [
      "Pressure and oxygen changed at the same time.",
      "IV-1 has no oxygen-consumption calorimetry, so peak heat release cannot be compared.",
      "Both ran in microgravity; neither speaks to lunar gravity.",
    ],
    findings: ["saffire-practical-scale-kw", "saffire-smoke-main-hazard"],
  },
  {
    id: "fabric-three-sizes",
    title: "Same fabric, three sizes, two experiments",
    question: "What changes when the same cotton-fiberglass fabric burns as a narrow strip, a small card and a wide sheet?",
    ids: ["sibal-GMT222-T11", "saffire-2-5", "saffire-1-1"],
    varies: "Sample size, duct and experiment",
    observed: [
      "All three are the SIBAL cotton-fiberglass fabric in concurrent flow near 20 cm/s and 21 to 22 % oxygen.",
      "BASS-II GMT222-T11: a 12 mm wide strip in the glovebox duct at 19 cm/s and 21.0 % oxygen; NASA's table records it burned (final outcome not stated).",
      "Saffire 2-5: 5 cm wide and 29 cm long at 20 cm/s and about 22.1 % oxygen; it burned the full 29 cm at 2.1 mm/s.",
      "Saffire 1-1: 40.6 by 94 cm at 20 cm/s and 21.7 % oxygen; average spread 1.8 mm/s through the 420 s test.",
    ],
    interpretation:
      "NASA notes the 5 cm sample spread marginally faster than the 40.6 cm sheet, partly because of its slightly higher starting oxygen and possibly because of side entrainment. Sample size, duct and vehicle all changed between these runs, so they illuminate related behaviour; they are not replicas of each other.",
    gaps: [
      "The BASS-II strip has no spread rate in its table.",
      "Different ducts, sample holders and vehicles.",
      "Oxygen differs slightly (21.0 to about 22.1 %).",
    ],
    findings: ["saffire-steady-wide-flame", "saffire-confined-slower"],
  },
];

export const getPreset = (id: string) => PRESETS.find((p) => p.id === id);
