/**
 * Mission atmosphere profiles. Each NASA profile is cited to a verified finding; none is "the" Moon-base atmosphere.
 * Values are the ones the cited NASA text states, nothing interpolated.
 */
export type AtmosphereProfile = {
  id: "iss" | "ea-a" | "ea-alt" | "custom";
  name: string;
  short: string;
  o2: number | null;
  kpa: number | null;
  status: string;
  why: string;
  finding: string | null; // verified quote id (data/curated/findings.json)
  where: string; // the meeting and NTRS distribution year, from the NTRS record
};

export const ATMOSPHERES: AtmosphereProfile[] = [
  {
    id: "iss",
    name: "ISS-like cabin",
    short: "101.3 kPa · 21 %",
    o2: 21,
    kpa: 101.3,
    status: "Sea-level pressure and normal oxygen: the conditions of every BASS-II test",
    why: "The atlas holds the most evidence here: 56 BASS-II tests ran near sea-level pressure at 14 to 21 % oxygen.",
    finding: null,
    where: "BASS-II test conditions",
  },
  {
    id: "ea-a",
    name: "Exploration atmosphere A",
    short: "56.5 kPa · 34 %",
    o2: 34,
    kpa: 56.5,
    status: "Recommended by NASA for future Moon and Mars missions",
    why: "NASA describes it as a compromise that balances the prebreathe time before a spacewalk, hypoxia and flammability risk.",
    finding: "exploration-atmosphere",
    where: "ICAM 2022 · NTRS 2022",
  },
  {
    id: "ea-alt",
    name: "Alternate exploration atmosphere",
    short: "66.2 kPa · 28.5 %",
    o2: 28.5,
    kpa: 66.2,
    status: "Evaluated in NASA's later Exploration Atmosphere Tests 3, 4 and 6",
    why: "NASA tested this sub-30 % oxygen cabin because the 34 % environment poses a flammability risk that requires material changes.",
    finding: "alt-exploration-atmosphere",
    where: "AsMA 2025 · NTRS 2024; called the proposed Exploration Atmosphere at AsMA 2026",
  },
  {
    id: "custom",
    name: "Custom",
    short: "your values",
    o2: null,
    kpa: null,
    status: "A research scenario you set",
    why: "Any oxygen and pressure you choose; the atlas shows how much evidence exists there.",
    finding: null,
    where: "",
  },
];

export const profileFor = (o2: number, kpa: number) =>
  ATMOSPHERES.find((a) => a.o2 === o2 && a.kpa === kpa) ?? ATMOSPHERES[ATMOSPHERES.length - 1];
