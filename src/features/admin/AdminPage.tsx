import { ExampleLabel } from '../../components/common/ExampleLabel';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useCopy } from '../../lib/language';
import { PasscodeGate } from '../stats/PasscodeGate';
import { CsvUpload } from './CsvUpload';
import { EXAMPLE_PRODUCTS, EXAMPLE_REPORTS } from './fixtures';
import { ProductList } from './ProductList';
import { ReportList } from './ReportList';

/** Behind the gate. A fragment, so the sticky ExampleLabel stays up for the whole page. */
export function AdminBody() {
  const { t } = useCopy();
  return (
    <>
      <ExampleLabel />
      <p className="-mt-4 text-[15px]">{t.ops.exampleSub}</p>
      <CsvUpload />
      <ProductList products={EXAMPLE_PRODUCTS} />
      <ReportList reports={EXAMPLE_REPORTS} />
    </>
  );
}

/** S7 `/admin`. Butter header (curated store products). Passcode gate (UI only) → example data. */
export function AdminPage() {
  const { t } = useCopy();
  return (
    <section className="flex flex-col gap-8 pb-8">
      <ScreenHeader tone="butter" title={t.ops.admin.title} back={{ to: '/', label: t.ops.home }} />
      <PasscodeGate>{() => <AdminBody />}</PasscodeGate>
    </section>
  );
}
