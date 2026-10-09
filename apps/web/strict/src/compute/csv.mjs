// A small RFC 4180 reader, shared by the compute loaders and the PSI fetcher. Pure: text in, rows out.
// Handles quoted fields, doubled quotes, and commas or line breaks inside quotes. Cells are trimmed,
// and a blank cell becomes null, never 0 or ''.
export function parseCsv(text) {
  const s = String(text).replace(/^﻿/, ''), rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (s[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim() || null));
}

// Rows keyed by the file's own column names (with runs of spaces collapsed). Values stay as written.
export function tableFrom(text) {
  const [header = [], ...rows] = parseCsv(text);
  const columns = header.map(h => (h ?? '').replace(/\s+/g, ' ').trim());
  return { columns, rows: rows.filter(r => r.some(c => c !== null)).map(r => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? null]))) };
}
