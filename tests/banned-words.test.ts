import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// P4. The list lives in scripts/banned-words.json so src/ never contains the words literally.
// scripts/check-words.mjs runs the same list against dist/ after the build.
const root = join(import.meta.dirname, '..');
const { words } = JSON.parse(readFileSync(join(root, 'scripts/banned-words.json'), 'utf8')) as {
  words: string[];
};
const SOURCE_DIRS = ['src', 'shared', 'api', 'server'];

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return listSourceFiles(p);
    return /\.(ts|tsx|js|jsx|mjs|css|html)$/.test(name) ? [p] : [];
  });
}

function findHits(text: string): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w.toLowerCase()));
}

describe('banned words (P4)', () => {
  it('the list covers ko and en', () => {
    expect(words.length).toBeGreaterThanOrEqual(3);
    expect(words.some((w) => /[가-힣]/.test(w))).toBe(true);
    expect(words.some((w) => /^[a-z ]+$/i.test(w))).toBe(true);
  });
  it(`no source file in ${SOURCE_DIRS.join(', ')} or index.html contains them`, () => {
    const files = [
      ...SOURCE_DIRS.flatMap((d) => listSourceFiles(join(root, d))),
      join(root, 'index.html'),
    ];
    // ko.ts and en.ts are scanned as text here, so every UI string is covered.
    expect(files.map((f) => relative(root, f))).toEqual(
      expect.arrayContaining(['src/copy/ko.ts', 'src/copy/en.ts']),
    );
    const hits = files.flatMap((f) =>
      findHits(readFileSync(f, 'utf8')).map((w) => `${relative(root, f)}: ${w}`),
    );
    expect(hits).toEqual([]);
  });
  it('the matcher actually detects a planted word (case-insensitive)', () => {
    for (const w of words) expect(findHits(`x ${w.toUpperCase()} y`)).toEqual([w]);
  });
});
