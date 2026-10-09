// NASA Physical Sciences Informatics (PSI): the curated "Experimental table" CSV of an investigation.
// The PSI search page is a JavaScript app. Its open API redirects this download route to the file itself.
// Both tables below are public and CC0-1.0 (checked 2026-09-24 via /geode-py/ws/repo/investigations/<id>).
// PSI-25 cross-checks the O₂ values in data/bass-table.csv (test/psi.test.mjs). PSI-69 is kept as
// data/psi-69-flex.csv for the fire-response card (see data/psi-69-flex.provenance.json).
// Pre-fetch: node src/acquire/psi.mjs [PSI-25|PSI-69]  (then copy cache/<id>-experimental-table.json to demo_fixtures/)
import { fileURLToPath } from 'node:url';
import { fetchText } from './safe.mjs';
import { parseCsv, tableFrom } from '../compute/csv.mjs';

export { parseCsv, tableFrom };

export const PSI_25 = {
  investigation: 'PSI-25', title: 'BASS-II', file: 'PSI-25_Experimental table_BASS-II.csv',
  doi: '10.60555/4qc4-de67', license: 'CC0-1.0', record: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-25'
};
export const PSI_69 = {
  investigation: 'PSI-69', title: 'FLEX', file: 'PSI-69_Experimental table_FLEX.csv', encoding: 'windows-1252',
  doi: '10.60555/mbq8-0451', license: 'CC0-1.0', record: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-69'
};

export const PSI_99 = {
  investigation: 'PSI-99', title: 'Saffire-II', file: 'PSI-99_Experimental table_SAFFIRE-2.csv',
  doi: '10.60555/2chp-m469', license: 'CC0-1.0', record: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-99'
};

export async function experimentalTable(study = PSI_25) {
  const { data, source } = await fetchText(`https://psi.nasa.gov/geode-py/ws/studies/${study.investigation}/download`,
    { params: { file: study.file }, name: `${study.investigation.toLowerCase()}-experimental-table`, encoding: study.encoding });
  return { ...study, ...tableFrom(data), source };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const study = { 'PSI-25': PSI_25, 'PSI-69': PSI_69, 'PSI-99': PSI_99 }[process.argv[2] ?? 'PSI-25'];
  if (!study) throw Error('Use PSI-25, PSI-69 or PSI-99.');
  const table = await experimentalTable(study);
  console.log({ ...table, rows: `${table.rows.length} rows`, first: table.rows[0] });
}
