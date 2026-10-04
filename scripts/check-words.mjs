// After `vite build`: fail if any P4 banned word (scripts/banned-words.json) appears in dist/.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const { words } = JSON.parse(readFileSync(join(root, 'scripts/banned-words.json'), 'utf8'));

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

if (!existsSync(dist)) {
  console.error('check-words: dist/ not found. Run `npm run build` first.');
  process.exit(2);
}

// Bundlers may emit non-ASCII as \uXXXX escapes, so also search for the escaped form.
const escape = (w) =>
  [...w].map((c) => (c.charCodeAt(0) > 127 ? `\\u${c.charCodeAt(0).toString(16)}` : c)).join('');
const needles = words.flatMap((w) => [w.toLowerCase(), escape(w).toLowerCase()]);

const hits = [];
const files = listFiles(dist);
for (const file of files) {
  const content = readFileSync(file, 'utf8').toLowerCase();
  for (const n of new Set(needles))
    if (content.includes(n)) hits.push(`${relative(root, file)}: "${n}"`);
}

if (hits.length) {
  console.error(`check-words: FAIL — ${hits.length} hit(s):\n  ${hits.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-words: OK — ${files.length} files in dist/, ${words.length} banned words checked.`,
);
