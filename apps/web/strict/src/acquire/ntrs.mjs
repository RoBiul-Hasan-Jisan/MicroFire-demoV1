// NASA Technical Reports Server: citation metadata for the BASS-II report.
// The 20 test rows themselves are hand-transcribed into data/bass-table.csv (see
// data/provenance.json); this module confirms the source record the rows cite.
// Pre-fetch for the demo: node src/acquire/ntrs.mjs  (then copy cache/ntrs-20210011385.json to demo_fixtures/)
import { fileURLToPath } from 'node:url';
import { fetchJson } from './safe.mjs';

export const REPORT_ID = '20210011385';

export async function reportCitation(id = REPORT_ID) {
  const { data, source } = await fetchJson(`https://ntrs.nasa.gov/api/citations/${id}`, { name: `ntrs-${id}` });
  return { id, title: data.title, published: data.publications?.[0]?.publicationDate ?? null,
    url: `https://ntrs.nasa.gov/citations/${id}`, source };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await reportCitation());
