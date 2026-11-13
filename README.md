# n8n CSV to Google Sheets: columns shifted, rows misaligned (quoted delimiters)

Your Sheet looks right for the first rows, then every value slides one column left, or a phone number lands in the city column. Nothing is corrupted. The parser split the line on the delimiter and a field that *contained* the delimiter became two fields.

Excel and Google Sheets open the same file correctly, which is why this looks like an n8n bug and is not one: a real CSV parser tracks quote state, and a `split(delimiter)` does not.

## Which one you have

| What you see | What is actually in the file |
|---|---|
| Values slide one column from a specific row down | An unquoted line break inside a cell, so the rest of that row became the next row |
| `notes` holds text that belongs in `status` | A quoted field contains the delimiter: `"paid; urgent"` splits into two |
| `Invalid Record Length: columns length is 7, got 13` | Two quoted values in one row, each containing the delimiter |
| Last column empty, everything else fine | Trailing delimiter from a spreadsheet export |
| One cell short, the last value missing | The exporter omitted a trailing empty cell |
| `got 1` on every row | Wrong delimiter setting: file is `;`, node is set to `,` |

The usual workaround on forums is a Code node doing `line.split(delimiter)`. It fixes the trailing-delimiter case and breaks every quoted case, so the import "works" and the data is quietly wrong. That is worse than the error.

## Measured, not claimed

A 6-line fixture with one quoted delimiter, one embedded line break, one doubled quote, one trailing delimiter and one short row. Run on Node 26, 2026-11-13:

```
plain split(delimiter)      -> 8 "rows", widths 7,8,4,4,7,5,8   (4 rows unimportable)
the parser below            -> 5 rows, 7 columns each
  "paid; urgent"            -> kept as one field
  "line one\nline two"      -> kept as one field
  short row                 -> padded to 7, status = ""
  "Eva ""Ev"";MSc"          -> Eva "Ev";MSc
```

The code published here was extracted from this repo and executed against that fixture, so the file ships the tested version and not a paraphrase of it.

## The Code node

Run Once for All Items. Input: one item with the file text in `csv`.
Output: one item per row, every row exactly `header.length` fields, plus `__source_line` so a bad row can be traced back to the original.

```js
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
```

Read `code-node.js` in this repo to copy it without markdown inside the way. Import `csv-repair-quoted.json` for a ready workflow: Manual Trigger → Code node, then attach your Sheets node to the output.

## Where this stops

- It repairs **shape**, not meaning. A value lost upstream stays lost; `__source_line` tells you which rows to check.
- A row with more fields than the header keeps the extra text appended to the last column instead of being dropped. Silently deleting a value is the failure mode this repo exists to avoid, so the surplus is visible, not hidden.
- Only the delimiter you set is handled. A file with mixed `,` and `;` needs a real sniffing parser.
- Encoding is not guessed. Mojibake (`Ã©`) is a separate repair, done by the browser tool below.

## Do it in the browser instead, free

[Free CSV repair](https://fejzadenis.github.io/leadflow/free) pads ragged rows, strips trailing delimiters, fixes quoting and encoding, dedupes, and returns the fixed file with a report of every row it changed. The file is read with the browser's own file API and repaired in the tab: no upload, no account, no analytics.

## If you would rather hand it to a person

One file, one row class, a human repairs it and sends it back with a report naming every changed row and every value rewritten. **$49 for up to 5,000 rows, back within 24 hours, 14-day refund** if the delivered file does not match that sentence. Bigger or nastier files are quoted before any work starts: [the 15 import failures and the repair offer](https://fejzadenis.github.io/leadflow/).

Not ready to spend anything: the browser tool and the Code node above are the whole fix. Mail the broken file to perun.intelligence@gmail.com only if you want a human to look at it first.

---

Tested 2026-11-13 · Node 26.13 · n8n 2.x Code node · MIT for the code in this repo.
