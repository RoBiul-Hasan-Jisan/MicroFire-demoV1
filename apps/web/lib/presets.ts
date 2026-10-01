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
    title: "Same film, same oxygen, different airflow",
    question: "At about 16.5 % oxygen, what does airflow alone do to a thin PMMA flame?",
    ids: ["bass2-B16", "bass2-B20", "bass2-B19"],
    varies: "Airflow",
    observed: [
      "All three are 2-cm-wide, 100-µm PMMA films in opposed flow, run on the same listed date at 16.4–16.5 % oxygen.",
      "B16 started at 3 cm/s; NASA notes the flame quenched after a prolonged burn once the fan was turned down to a 0.4 setting.",
      "B20 ran at 5 then 3 cm/s, then a 0.5 fan setting; NASA notes the flame burned the entire sample.",
      "B19 ran at 10 cm/s and NASA notes the flame blew out.",
    ],
    interpretation:
      "Read together, the three runs bracket a flammability window at this oxygen level: too little flow and the flame starved, a moderate flow sustained it, a stronger flow blew it out. That matches the quenching and blowoff limits NASA reports for other PMMA geometries, but three runs do not locate the boundaries precisely.",
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
      "Lower oxygen made the flame vulnerable to blowoff at a flow it survived at near-normal oxygen. This is consistent with NASA's PMMA rod work, where the blowoff limit depends on oxygen concentration. Two runs show the direction of the effect, not its size.",
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
      "Halving the flow slowed the fire. In a cabin, slower ventilation means a slower-growing flame — but the other comparisons show that cutting flow too far can also let a dim flame persist rather than go out.",
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
];

export const getPreset = (id: string) => PRESETS.find((p) => p.id === id);
