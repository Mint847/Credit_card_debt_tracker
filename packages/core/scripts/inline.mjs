// Puts the built core into index.html between the CORE:START / CORE:END markers, so the
// phone/iPad app stays a single self-contained file (same deploy, same tests).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const bundle = readFileSync(join(here, '..', 'dist', 'core.js'), 'utf8').trim();
const page = join(here, '..', '..', '..', 'web', 'index.html');
const html = readFileSync(page, 'utf8');

const start = html.indexOf('<!-- CORE:START');
const end = html.indexOf('<!-- CORE:END -->');
if (start < 0 || end < 0) throw new Error('CORE markers not found in index.html');
const open = html.indexOf('-->', start) + 3;
const nl = html.includes('\r\n') ? '\r\n' : '\n';
const body = bundle.replace(/\r?\n/g, nl).replace(/<\/script/gi, '<\\/script');

const out = html.slice(0, open) + nl + '  <script>' + nl + body + nl + '  </script>' + nl + '  ' + html.slice(end);
writeFileSync(page, out);
console.log('core inlined into index.html (' + Math.round(body.length / 1024) + ' KB)');
