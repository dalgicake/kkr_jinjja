// PLAN 7.4 eval: markdown report and NNN.draft.json (pure).
import type { TagReading } from '../../shared/tag.js';
import { formatWon } from '../../shared/units.js';
import {
  FIELDS,
  TARGETS,
  aggregate,
  groupByStore,
  median,
  type Field,
  type FieldAccuracy,
  type ImageResult,
} from './score.js';

// ---------------------------------------------------------------------------
// Report (markdown)
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<Field, string> = {
  storePrice: '매장가 (정확히 일치)',
  brand: '브랜드 (정규화 후 일치)',
  size: '개당 용량 (1% 이내 + 단위 일치)',
  count: '수량 (일치)',
  sizeAndCount: '용량+수량 (둘 다 맞음)',
  promoType: '행사 유형 (일치)',
  variant: '종류 (참고용)',
};

const FIELD_TARGETS: Partial<Record<Field, number>> = {
  storePrice: TARGETS.storePrice,
  brand: TARGETS.brand,
  sizeAndCount: TARGETS.sizeAndCount,
};

export function formatRate(acc: FieldAccuracy): string {
  return acc.rate === null ? '미확인' : `${(acc.rate * 100).toFixed(1)}%`;
}

const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const show = (v: string | number | null): string =>
  v === null ? '없음' : typeof v === 'number' ? String(v) : `"${v}"`;
const showPrice = (v: number | null): string => (v === null ? '없음' : `${formatWon(v)}원`);
const showSize = (r: TagReading): string =>
  r.per_item_amount === null && r.per_item_unit === null
    ? '없음'
    : `${r.per_item_amount ?? '?'}${r.per_item_unit ?? '?'}`;

function mark(ok: boolean, pred: string, truth: string): string {
  return ok ? `✓ ${pred}` : `✗ 읽음 ${pred} / 정답 ${truth}`;
}

function imageRow(r: ImageResult): string {
  const t = r.truth;
  const p = r.pred;
  const store = r.storeName ?? '미확인';
  if (!p) {
    return `| ${r.id} | ${cell(store)} | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ${cell(`읽기 실패: ${r.error ?? '알 수 없음'}`)} |`;
  }
  const cols = [
    mark(r.scores.storePrice, showPrice(p.store_price), showPrice(t.store_price)),
    mark(r.scores.brand, show(p.brand), show(t.brand)),
    mark(r.scores.size, showSize(p), showSize(t)),
    mark(r.scores.count, show(p.item_count), show(t.item_count)),
    mark(r.scores.promoType, p.promo.type, t.promo.type),
    mark(r.scores.variant, show(p.variant), show(t.variant)),
    r.error ?? '',
  ];
  return `| ${r.id} | ${cell(store)} | ${cols.map(cell).join(' | ')} |`;
}

export interface ReportInput {
  model: string;
  generatedAt: string; // ISO
  imageCount: number;
  rows: ImageResult[];
  /** images not scored: no NNN.json, still a draft, or invalid JSON. */
  skipped: { id: string; reason: string }[];
}

export function renderReport(input: ReportInput): string {
  const { rows } = input;
  const acc = aggregate(rows.map((r) => r.scores));
  const failed = rows.filter((r) => !r.pred).length;
  const ms = median(rows.map((r) => r.ms).filter((v): v is number => v !== null));
  const costs = rows.map((r) => r.costKrw);
  const costKnown = costs.length > 0 && costs.every((c) => c !== null);
  const totalCost = costs.reduce<number>((a, c) => a + (c ?? 0), 0);

  const lines: string[] = [];
  lines.push('# 가격표 읽기 정확도 (PLAN 7.4)', '');
  lines.push(`- 모델: \`${input.model}\` (env \`MODEL_TAG\`)`);
  lines.push(`- 생성: ${input.generatedAt}`);
  lines.push(
    `- 사진 ${input.imageCount}장 중 채점 ${rows.length}장, 제외 ${input.skipped.length}장 (정답 없음·초안·형식 오류)`,
  );
  lines.push(`- 읽기 실패 ${failed}장 — 실패한 사진은 모든 항목을 오답으로 계산`);
  lines.push(
    `- 지연 중앙값(서버 함수 기준, 네트워크 업로드 제외): ${ms === null ? '미확인' : `${Math.round(ms)}ms`}`,
  );
  lines.push(
    `- 비용 합계: ${costKnown ? `${Math.round(totalCost * 100) / 100}원` : '미확인 (core가 비용을 돌려주지 않은 사진이 있음)'}`,
  );
  lines.push('');

  lines.push('## 필드별 정확도', '');
  lines.push('| 항목 | 맞음/전체 | 정확도 | Phase 1 기준 | 결과 |');
  lines.push('|---|---|---|---|---|');
  for (const f of FIELDS) {
    const a = acc[f];
    const target = FIELD_TARGETS[f];
    const targetText =
      target === undefined ? (f === 'variant' ? '참고용' : '—') : `≥ ${target * 100}%`;
    const verdict =
      target === undefined || a.rate === null ? '—' : a.rate >= target ? '통과' : '미달';
    lines.push(
      `| ${FIELD_LABELS[f]} | ${a.correct}/${a.total} | ${formatRate(a)} | ${targetText} | ${verdict} |`,
    );
  }
  lines.push('');

  const stores = groupByStore(rows);
  if (stores.length) {
    lines.push('## 매장별 정확도 (정답 JSON의 `_meta.storeName`이 있는 사진만)', '');
    lines.push('| 매장 | 사진 | 매장가 | 브랜드 | 용량+수량 | 행사 유형 |');
    lines.push('|---|---|---|---|---|---|');
    for (const s of stores) {
      const a = s.accuracy;
      lines.push(
        `| ${cell(s.storeName)} | ${a.storePrice.total} | ${formatRate(a.storePrice)} | ${formatRate(a.brand)} | ${formatRate(a.sizeAndCount)} | ${formatRate(a.promoType)} |`,
      );
    }
    const unknown = rows.filter((r) => !r.storeName).length;
    if (unknown) lines.push('', `매장 미확인 사진 ${unknown}장은 매장별 표에서 뺐다.`);
    lines.push('');
  }

  lines.push('## 사진별 결과', '');
  lines.push(
    '| 사진 | 매장 | 매장가 | 브랜드 | 개당 용량 | 수량 | 행사 유형 | 종류(참고) | 메모 |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) lines.push(imageRow(r));
  lines.push('');

  if (input.skipped.length) {
    lines.push('## 채점 제외', '');
    for (const s of input.skipped) lines.push(`- ${s.id}: ${s.reason}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Draft (NNN.draft.json — never NNN.json)
// ---------------------------------------------------------------------------

export function buildDraft(
  reading: TagReading,
  info: { model: string; createdAt: string; unreadable: boolean },
): Record<string, unknown> {
  return {
    _meta: {
      draft: true,
      storeName: null,
      model: info.model,
      createdAt: info.createdAt,
      unreadable: info.unreadable,
      howTo:
        'Model output, NOT ground truth. Compare every field with the photo and fix it, set storeName, then set draft to false and save as NNN.json.',
    },
    ...reading,
  };
}
