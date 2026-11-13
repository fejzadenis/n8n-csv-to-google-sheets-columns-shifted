const fs = require('fs');
const code = fs.readFileSync('perun-intelligence/perun-control/.tmp/repo-shift/code-node.js','utf8');

const fixture = 'id;name;city;notes;amount;date;status\r\n' +
 '1;Ana;Nis;"paid; urgent";100;2026-01-02;open\r\n' +
 '2;Bora;Novi Sad;"line one\nline two";250;2026-01-03;open\r\n' +
 '3;Cina;Subotica;plain;75;2026-01-04;\r\n' +
 '4;Dado;Kragujevac;short;50\r\n' +
 '5;"Eva ""Ev"";MSc";Beograd;quoted quote;9;2026-01-05;closed\r\n';

const naive = fixture.split(/\r?\n/).filter(l=>l.trim()).map(l=>l.split(';'));
fs.writeFileSync('.tmp-naive.txt', '');
console.log('naive widths (what a plain split gives n8n): ' + naive.map(r=>r.length).join(','));

const $input = { first: () => ({ json: { csv: fixture } }) };
const console_ = console;
const fn = new Function('$input', 'console', code);
const out = fn($input, console_);
const rows = out.map(o => o.json);
console.log('published code -> items=' + rows.length);
console.log('columns=' + JSON.stringify(Object.keys(rows[0]).filter(k => k !== '__source_line')));
console.log('all width equal=' + rows.every(r => Object.keys(r.json ? r.json : r).length - 1 === 7));
console.log('quoted semicolon kept=' + JSON.stringify(rows[0].notes));
console.log('embedded newline kept=' + JSON.stringify(rows[1].notes));
console.log('short row padded=' + JSON.stringify(rows[3].status) + '|' + JSON.stringify(rows[3].amount));
console.log('doubled quote=' + JSON.stringify(rows[4].name));
