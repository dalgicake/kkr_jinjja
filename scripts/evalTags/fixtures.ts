// PLAN 7.4 eval: fixture discovery and ground truth (pure; no fs).
import { parseRecordTag, type TagReading } from '../../shared/tag.js';

const IMAGE_RE = /^(\d{3,})\.(jpe?g|png|webp)$/i;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Fixture discovery (pure: file names in, plan out)
// ---------------------------------------------------------------------------

export interface FixtureEntry {
  id: string; // "001"
  image: string; // "001.jpg"
  truthFile: string | null; // "001.json"
  draftFile: string | null; // "001.draft.json"
}

export function planFixtures(fileNames: readonly string[]): FixtureEntry[] {
  const names = new Set(fileNames);
  const seen = new Set<string>();
  const out: FixtureEntry[] = [];
  for (const name of [...fileNames].sort()) {
    const m = IMAGE_RE.exec(name);
    if (!m) continue;
    const id = m[1] as string;
    if (seen.has(id)) continue; // 001.jpg and 001.png: keep the first (sorted) one
    seen.add(id);
    out.push({
      id,
      image: name,
      truthFile: names.has(`${id}.json`) ? `${id}.json` : null,
      draftFile: names.has(`${id}.draft.json`) ? `${id}.draft.json` : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ground truth (NNN.json = TagReading + optional "_meta")
// ---------------------------------------------------------------------------

export interface FixtureMeta {
  storeName: string | null;
  draft: boolean;
}

export type GroundTruthResult =
  { ok: true; truth: TagReading; meta: FixtureMeta } | { ok: false; error: string };

export function readMeta(json: unknown): FixtureMeta {
  const meta = isRecord(json) && isRecord(json._meta) ? json._meta : {};
  const store = typeof meta.storeName === 'string' ? meta.storeName.trim() : '';
  return { storeName: store === '' ? null : store, draft: meta.draft === true };
}

/** Same 7.3 pipeline as the server (unit re-normalization → zod → normalize), so "1.5L" style is fine. */
export function parseGroundTruth(json: unknown): GroundTruthResult {
  const meta = readMeta(json);
  if (meta.draft) {
    return {
      ok: false,
      error:
        '_meta.draft is still true — check every field against the photo, then set it to false',
    };
  }
  const parsed = parseRecordTag(json);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, truth: parsed.reading, meta };
}
