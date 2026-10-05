import { useCopy } from '../../lib/language';
import type { CuratedProduct } from './confirmForm';
import { productLabel } from './labels';

/** "혹시 이 상품?" — up to 3 curated products whose name is similar (search_products). */
export function ProductSuggestions({
  products,
  onPick,
}: {
  products: readonly CuratedProduct[];
  onPick: (p: CuratedProduct) => void;
}) {
  const { t } = useCopy();
  if (products.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="confirm-suggestions">
      <h2 id="confirm-suggestions" className="text-[17px] font-extrabold">
        {t.confirm.suggestions}
      </h2>
      <p className="text-[13px] text-muted">{t.confirm.suggestionsSub}</p>
      <ul className="flex flex-col gap-2">
        {products.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="min-h-12 w-full sticker rounded-lg border-2 border-ink bg-receipt px-4 py-2 text-left text-[15px] font-bold tabular-nums"
            >
              {productLabel(t, {
                brand: p.brand,
                productName: p.name,
                variant: p.variant,
                perItemAmount: p.perItemAmount,
                perItemUnit: p.perItemUnit,
                itemCount: p.itemCount,
              })}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
