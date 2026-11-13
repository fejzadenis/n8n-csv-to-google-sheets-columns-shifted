// n8n Code node - mode: Run Once for All Items
// input: one item { csv: "<file contents as text>" }
// Output: one item per row, every row exactly header.length fields.
const DELIM = ';'; // ',' for comma-separated exports
const text = String($input.first().json.csv ?? '').replace(/^\uFEFF/, '');

function parseCSV(s, d) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c === '\r') { /* skip CR, keep LF handling simple */ }
    else cur += c;
  }
  row.push(cur); rows.push(row);
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

const rows = parseCSV(text, DELIM);
if (!rows.length) return [];
const header = rows.shift().map((h, i) => h.trim() || 'unnamed_' + (i + 1));
const n = header.length;
const out = [];
let padded = 0, overflow = 0, exact = 0;

for (let i = 0; i < rows.length; i++) {
  const c = rows[i].slice();
  while (c.length > n && c[c.length - 1].trim() === '') c.pop();
  if (c.length < n) { while (c.length < n) c.push(''); padded++; }
  else if (c.length > n) { overflow++; while (c.length > n) c[n - 1] += ' ' + c.pop(); }
  else exact++;
  const o = { __source_line: i + 2 };
  for (let j = 0; j < n; j++) o[header[j]] = (c[j] === undefined ? '' : String(c[j]).trim());
  out.push(o);
}

// counts for the node output panel: padded / overflow / exact
console.log(JSON.stringify({ rows: out.length, exact, padded, overflow, columns: n }));
return out.map(r => ({ json: r }));
