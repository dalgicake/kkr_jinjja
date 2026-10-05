// C1-5 / PLAN 7.4 — price-tag reading accuracy (CLI runner; logic lives in scripts/evalTags/).
//
//   npm run eval:tags                      → fixtures/tags/NNN.jpg vs NNN.json → fixtures/tags/_report.md
//   MODEL_TAG=claude-haiku-4-5-20251001 npm run eval:tags   (same table, other model)
//   npm run eval:tags -- --draft           → NNN.draft.json for Kiryeong to check field by field
//
// Every photo goes through the same code as /api/read-tag: server/readTag.ts `handleReadTag`
// (decode + 4MB limit, prompt, forced tool call, zod, one retry, 15 s, unreadable → 422) with the
// real Anthropic client and an in-memory ServerStore (no Supabase writes, no rate limit).
// --draft never writes NNN.json: a human must check each field against the photo (7.4).
// The pure scoring/report functions live in scripts/evalTags/ and are tested in
// tests/eval/evalTags.test.ts.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAnthropicClient } from '../server/anthropic.js';
import { DEFAULT_MODEL_TAG, DEFAULT_USD_KRW } from '../server/env.js';
import { MAX_IMAGE_BYTES } from '../server/readTag.js';
import type { TagReading } from '../shared/tag.js';
import { HELP, parseArgs } from './evalTags/args.js';
import {
  allModelApiErrors,
  createReadTagCore,
  type CoreOutcome,
  type ReadTagCore,
} from './evalTags/core.js';
import {
  parseGroundTruth,
  planFixtures,
  type FixtureEntry,
  type FixtureMeta,
} from './evalTags/fixtures.js';
import { buildDraft, formatRate, renderReport, type ReportInput } from './evalTags/report.js';
import { FIELDS, aggregate, scoreReading, type ImageResult } from './evalTags/score.js';

// ---------------------------------------------------------------------------
// Runtime (side effects below this line)
// ---------------------------------------------------------------------------

function fail(message: string): never {
  console.error(`eval-tags: ${message}`);
  process.exit(1);
}

function loadEnvFiles(root: string): void {
  for (const f of ['.env.local', '.env']) {
    const p = join(root, f);
    if (existsSync(p)) process.loadEnvFile(p); // never overrides values already set
  }
}

async function readOne(
  core: ReadTagCore,
  dir: string,
  entry: FixtureEntry,
  model: string,
): Promise<{ outcome: CoreOutcome; bytes: number }> {
  const buf = readFileSync(join(dir, entry.image));
  const started = performance.now();
  let outcome: CoreOutcome;
  try {
    outcome = await core({ imageBase64: buf.toString('base64'), model });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    outcome = { ok: false, error, costKrw: null, ms: null, modelReading: null };
  }
  if (outcome.ms === null) outcome.ms = Math.round(performance.now() - started);
  return { outcome, bytes: buf.length };
}

function sizeHint(bytes: number): string {
  return bytes > MAX_IMAGE_BYTES
    ? ` (사진 ${(bytes / 1024 / 1024).toFixed(1)}MB > 4MB — 줄여서 다시: sips -Z 2048 <파일>)`
    : '';
}

function usdKrwFromEnv(): number {
  const raw = process.env.USD_KRW?.trim();
  const n = raw ? Number(raw) : DEFAULT_USD_KRW;
  if (!Number.isFinite(n) || n <= 0) fail(`USD_KRW must be a positive number (got "${raw}")`);
  return n;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if ('error' in parsed) fail(`${parsed.error}\n\n${HELP}`);
  if (parsed.help) {
    console.log(HELP);
    return;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = resolve(root, parsed.dir ?? 'fixtures/tags');
  loadEnvFiles(root);

  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`folder not found: ${dir}`);
  const entries = planFixtures(readdirSync(dir));
  if (!entries.length) {
    fail(
      `no photos in ${dir}. Put price-tag photos there as 001.jpg, 002.jpg … (see fixtures/tags/README.md).`,
    );
  }
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    fail(
      'ANTHROPIC_API_KEY is not set. Put it in .env.local (see BLOCKED.md B0-2) or run `ANTHROPIC_API_KEY=... npm run eval:tags`.',
    );
  }
  const model = process.env.MODEL_TAG?.trim() || DEFAULT_MODEL_TAG;
  const core = createReadTagCore({
    anthropic: createAnthropicClient(apiKey),
    usdKrw: usdKrwFromEnv(),
  });

  if (parsed.draft) {
    const todo = entries.filter((e) => !e.truthFile && (parsed.force || !e.draftFile));
    if (!todo.length) {
      console.log(
        'eval-tags --draft: nothing to do (every photo has NNN.json or NNN.draft.json; --force redoes drafts).',
      );
      return;
    }
    let written = 0;
    for (const e of todo) {
      const { outcome, bytes } = await readOne(core, dir, e, model);
      // A 422 still has the validated model output; it helps the human even if the app refused it.
      const reading = outcome.ok ? outcome.reading : outcome.modelReading;
      if (!reading) {
        console.error(
          `  ${e.id}: not written — ${outcome.ok ? '' : outcome.error}${sizeHint(bytes)}`,
        );
        continue;
      }
      const draft = buildDraft(reading, {
        model,
        createdAt: new Date().toISOString(),
        unreadable: !outcome.ok,
      });
      writeFileSync(join(dir, `${e.id}.draft.json`), `${JSON.stringify(draft, null, 2)}\n`);
      written++;
      console.log(
        `  ${e.id}: ${e.id}.draft.json${outcome.ok ? '' : ` (app would fail: ${outcome.error})`}`,
      );
    }
    console.log(
      `\neval-tags --draft: ${written}/${todo.length} drafts written with ${model}.\n` +
        'These are model guesses, not answers. Check every field against the photo, then save as NNN.json with "_meta.draft": false.',
    );
    return;
  }

  const skipped: ReportInput['skipped'] = [];
  const scorable: { entry: FixtureEntry; truth: TagReading; meta: FixtureMeta }[] = [];
  for (const e of entries) {
    if (!e.truthFile) {
      skipped.push({ id: e.id, reason: e.draftFile ? '초안만 있음 (확인 전)' : '정답 JSON 없음' });
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(join(dir, e.truthFile), 'utf8'));
    } catch (err) {
      skipped.push({ id: e.id, reason: `${e.truthFile} JSON 오류: ${(err as Error).message}` });
      continue;
    }
    const gt = parseGroundTruth(json);
    if (!gt.ok) skipped.push({ id: e.id, reason: `${e.truthFile}: ${gt.error}` });
    else scorable.push({ entry: e, truth: gt.truth, meta: gt.meta });
  }
  if (!scorable.length) {
    fail(
      `${entries.length} photo(s) but no usable ground truth NNN.json. Run \`npm run eval:tags -- --draft\`, check each draft against its photo, then save it as NNN.json.\n` +
        skipped.map((s) => `  ${s.id}: ${s.reason}`).join('\n'),
    );
  }

  console.log(`eval-tags: ${scorable.length} photo(s) with ${model}`);
  const rows: ImageResult[] = [];
  for (const { entry, truth, meta } of scorable) {
    const { outcome, bytes } = await readOne(core, dir, entry, model);
    let pred: TagReading | null = null;
    let error: string | null = null;
    if (outcome.ok) pred = outcome.reading;
    else error = outcome.error + sizeHint(bytes);
    const scores = scoreReading(pred, truth);
    rows.push({
      id: entry.id,
      storeName: meta.storeName,
      truth,
      pred,
      error,
      scores,
      ms: outcome.ms,
      costKrw: outcome.costKrw,
    });
    console.log(
      `  ${entry.id}: ${error ? `FAIL ${error}` : FIELDS.filter((f) => !scores[f]).join(', ') || 'all correct'}`,
    );
  }

  if (allModelApiErrors(rows.map((r) => r.error))) {
    fail(
      `every model call failed (502 model_error) — check ANTHROPIC_API_KEY, the network and MODEL_TAG="${model}". _report.md was not changed.`,
    );
  }

  const report = renderReport({
    model,
    generatedAt: new Date().toISOString(),
    imageCount: entries.length,
    rows,
    skipped,
  });
  const out = join(dir, '_report.md');
  writeFileSync(out, report);
  const acc = aggregate(rows.map((r) => r.scores));
  console.log(
    `\n매장가 ${formatRate(acc.storePrice)} / 브랜드 ${formatRate(acc.brand)} / 용량+수량 ${formatRate(acc.sizeAndCount)} → ${basename(dir)}/_report.md`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((e: unknown) => fail((e as Error).stack ?? String(e)));
}
