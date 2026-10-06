import type { Experiment, LuciRun, SaffireRun } from "@/lib/types";
export type Fam = "bass2" | "saffire" | "luci";
export type Row = { id: string; code: string; fam: Fam; material: string; o2: number | null; flow: number | null; kpa: number | null; group: string; label: string; href: string };
export const toRows = (d: Experiment[], s: SaffireRun[], l: LuciRun[]): Row[] => [
  ...d.map((e) => ({ id: e.id, code: e.test_id, fam: "bass2" as Fam, material: e.material, o2: e.oxygen_vol_pct, flow: e.flow_initial_cm_s, kpa: e.pressure_kpa ?? null, group: e.outcome_group as string, label: e.outcome_label, href: `/experiments/${e.id}` })),
  ...s.map((r) => ({ id: r.id, code: r.sample, fam: "saffire" as Fam, material: r.material, o2: r.o2_pct, flow: r.flow_cm_s, kpa: r.pressure_kpa ?? null, group: r.outcome_group as string, label: r.outcome_label, href: `/saffire#${r.id}` })),
  ...l.map((r) => ({ id: r.id, code: r.sample, fam: "luci" as Fam, material: r.material, o2: r.o2_start_pct, flow: null, kpa: 101, group: r.outcome_group as string, label: r.outcome_label, href: `/atlas#${r.id}` })),
];
