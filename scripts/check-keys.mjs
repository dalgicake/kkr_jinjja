// After `vite build`: fail if any server-only key NAME or VALUE appears in dist/.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SERVER_KEYS = [
  'ANTHROPIC_API_KEY',
  'NAVER_CLIENT_ID',
  'NAVER_CLIENT_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_PASSCODE',
];
const MIN_VALUE_LENGTH = 6; // ignore trivially short values to avoid false positives
const root = process.cwd();
const dist = join(root, 'dist');

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

if (!existsSync(dist)) {
  console.error('check-keys: dist/ not found. Run `npm run build` first.');
  process.exit(2);
}

const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];
const fileEnv = Object.assign({}, ...envFiles.map((f) => readEnvFile(join(root, f))));
const needles = SERVER_KEYS.map((name) => ({ label: `name ${name}`, text: name }));
for (const name of SERVER_KEYS) {
  for (const value of new Set([process.env[name], fileEnv[name]])) {
    if (value && value.length >= MIN_VALUE_LENGTH)
      needles.push({ label: `value of ${name}`, text: value });
  }
}

const hits = [];
const files = listFiles(dist);
for (const file of files) {
  const content = readFileSync(file, 'latin1') + '\n' + readFileSync(file, 'utf8');
  for (const n of needles)
    if (content.includes(n.text)) hits.push(`${relative(root, file)}: ${n.label}`);
}

const valueCount = needles.length - SERVER_KEYS.length;
if (hits.length) {
  console.error(`check-keys: FAIL — ${hits.length} hit(s):\n  ${hits.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-keys: OK — ${files.length} files in dist/, ${SERVER_KEYS.length} key names, ${valueCount} key values checked.`,
);
