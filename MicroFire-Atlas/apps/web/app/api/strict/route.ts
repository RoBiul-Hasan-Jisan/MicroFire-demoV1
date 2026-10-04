import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const runtime = "nodejs";

// The evidence core (strict/) is plain Node code with no model calls (see strict/test/boundary.test.mjs).
// It reads its data files by path, so it is loaded at run time instead of being bundled.
async function core(file: string) {
  const href = pathToFileURL(path.join(process.cwd(), "strict", "src", "compute", file)).href;
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ href);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get("view") === "response") return NextResponse.json((await core("response.mjs")).FIRE_RESPONSE);
    const params: Record<string, string> = { q: (sp.get("q") ?? "").slice(0, 500) };
    for (const k of ["mission", "air", "o2", "psi", "material", "thickness", "airflow"]) {
      const v = sp.get(k);
      if (v) params[k] = v;
    }
    return NextResponse.json((await core("scenario.mjs")).ask(params));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bad request" }, { status: 400 });
  }
}
