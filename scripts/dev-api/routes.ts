// DEV ONLY — maps /api/<path> to api/<path>.ts the way Vercel's filesystem routing does.
// Pure functions (plus one directory listing) so the routing rules are unit-tested.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface ApiRoute {
  /** Handler file relative to api/, posix separators (e.g. 'health.ts', 'admin/[id].ts'). */
  file: string;
  params: Record<string, string | string[]>;
}

const API_FILE = /\.(ts|mts|js|mjs)$/;
const NOT_A_FUNCTION = /(\.test|\.spec|\.d)\.(ts|mts|js|mjs)$/;

/** Lists api/ handler ids. Like Vercel: names starting with '_' or '.' are not functions. */
export function listApiFiles(apiDir: string, prefix = ''): string[] {
  let entries;
  try {
    entries = readdirSync(apiDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      out.push(...listApiFiles(join(apiDir, entry.name), `${prefix}${entry.name}/`));
    } else if (API_FILE.test(entry.name) && !NOT_A_FUNCTION.test(entry.name)) {
      out.push(prefix + entry.name);
    }
  }
  return out;
}

/** '/api/admin/links' → ['admin', 'links']; null when the path is not under /api or is unsafe. */
export function apiSegments(pathname: string): string[] | null {
  if (pathname !== '/api' && !pathname.startsWith('/api/')) return null;
  const segments: string[] = [];
  for (const raw of pathname.slice(4).split('/')) {
    if (!raw) continue;
    let seg: string;
    try {
      seg = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (seg === '.' || seg === '..' || /[\\/\0]/.test(seg)) return null;
    segments.push(seg);
  }
  return segments;
}

const CATCH_ALL = /^\[\.\.\.([A-Za-z0-9_]+)\]$/;
const DYNAMIC = /^\[([A-Za-z0-9_]+)\]$/;

/** Score per segment: static 3 > [param] 2 > [...rest] 1. Higher (lexicographic) wins. */
function matchFile(
  fileSegs: string[],
  urlSegs: string[],
): { params: ApiRoute['params']; score: number[] } | null {
  const params: ApiRoute['params'] = {};
  const score: number[] = [];
  for (let i = 0; i < fileSegs.length; i++) {
    const seg = fileSegs[i] as string;
    const rest = CATCH_ALL.exec(seg);
    if (rest) {
      if (i !== fileSegs.length - 1 || i >= urlSegs.length) return null;
      params[rest[1] as string] = urlSegs.slice(i);
      score.push(1);
      return { params, score };
    }
    const url = urlSegs[i];
    if (url === undefined) return null;
    const dyn = DYNAMIC.exec(seg);
    if (dyn) {
      params[dyn[1] as string] = url;
      score.push(2);
    } else if (seg === url) {
      score.push(3);
    } else {
      return null;
    }
  }
  return fileSegs.length === urlSegs.length ? { params, score } : null;
}

function better(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Resolves a request path against api/ files ('health.ts', 'admin/[id].ts', 'index.ts', ...).
 * Exact file > dir/index > [param] > [...rest]. Returns the file name (with extension).
 */
export function resolveApiRoute(pathname: string, files: readonly string[]): ApiRoute | null {
  const urlSegs = apiSegments(pathname);
  if (!urlSegs) return null;
  let best: { file: string; params: ApiRoute['params']; score: number[] } | null = null;
  for (const file of files) {
    const segs = file.replace(API_FILE, '').split('/');
    if (segs[segs.length - 1] === 'index') segs.pop();
    const m = matchFile(segs, urlSegs);
    if (m && (!best || better(m.score, best.score))) best = { file, ...m };
  }
  return best && { file: best.file, params: best.params };
}
