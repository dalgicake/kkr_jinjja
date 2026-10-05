import { useState } from 'react';
import { Badge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { Chip } from '../../components/common/Chip';
import { SectionBlock } from '../../components/common/SectionBlock';
import type { Tone } from '../../components/common/tone';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { sizeLabel } from '../confirm/labels';
import { RELATIONS, type AdminCandidate, type AdminProduct, type LinkRelation } from './fixtures';

/** same = lime (the match we want), other size = lilac (kept as a record), wrong = pink (flagged). */
const RELATION_TONE: Readonly<Record<LinkRelation, Tone>> = {
  same_item: 'lime',
  size_diff: 'lilac',
  wrong: 'pink',
};

function CandidateRow({ c }: { c: AdminCandidate }) {
  const { t, won } = useCopy();
  const a = t.ops.admin;
  const [relation, setRelation] = useState<LinkRelation | null>(null);
  return (
    <li className="flex flex-col gap-2 border-t-2 border-dotted border-ink py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[15px] font-bold">{c.title}</p>
          <p className="text-[13px] text-muted">{c.mallName ?? a.catalog}</p>
          <p className="text-[13px] tabular-nums">{sizeLabel(t, c)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="text-[17px] font-extrabold tabular-nums">{won(c.price)}</p>
          <Badge tone="white">{a.shippingUnknown}</Badge>
        </div>
      </div>
      <div role="group" aria-label={c.title} className="flex flex-wrap gap-2">
        {RELATIONS.map((r) => (
          <Chip
            key={r}
            tone={RELATION_TONE[r]}
            selected={relation === r}
            onClick={() => setRelation(relation === r ? null : r)}
          >
            {a.relations[r]}
          </Chip>
        ))}
      </div>
      {relation && (
        <p role="status" className="text-[13px] font-semibold">
          {fill(a.marked, { relation: a.relations[relation] })}
        </p>
      )}
    </li>
  );
}

function ProductRow({ p }: { p: AdminProduct }) {
  const { t } = useCopy();
  const a = t.ops.admin;
  const [open, setOpen] = useState(false);
  const listId = `${p.id}-candidates`;
  return (
    <li className="flex flex-col gap-3 rounded-lg border-2 border-ink bg-receipt p-3">
      <div className="flex flex-col gap-1">
        <p className="text-[17px] font-extrabold">{p.label}</p>
        <div className="flex flex-wrap gap-2">
          <Badge tone="butter">
            {p.barcode ? fill(a.barcode, { code: p.barcode }) : a.noBarcode}
          </Badge>
          <Badge
            tone={p.linkCount > 0 ? 'lime' : 'white'}
            icon={p.linkCount > 0 ? 'check' : 'none'}
          >
            {fill(a.links, { n: p.linkCount })}
          </Badge>
        </div>
      </div>
      <Button tone="sky" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
        {open ? a.hide : a.search}
      </Button>
      {open && (
        <div id={listId} className="flex flex-col items-start gap-1">
          <Badge tone="pink" icon="alert">
            {a.candidatesNote}
          </Badge>
          <ul className="flex flex-col self-stretch">
            {p.candidates.map((c) => (
              <CandidateRow key={c.externalId} c={c} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/** Curated products, each with [Search Naver] → per-candidate [Same item][Other size][Wrong]. */
export function ProductList({ products }: { products: readonly AdminProduct[] }) {
  const { t } = useCopy();
  return (
    <SectionBlock
      tone="sky"
      id="admin-products"
      title={fill(t.ops.admin.productsTitle, { n: products.length })}
    >
      <ul className="flex flex-col gap-4">
        {products.map((p) => (
          <ProductRow key={p.id} p={p} />
        ))}
      </ul>
    </SectionBlock>
  );
}
