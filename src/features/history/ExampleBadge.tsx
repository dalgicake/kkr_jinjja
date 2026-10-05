import { ExampleLabel } from '../../components/common/ExampleLabel';
import { useCopy } from '../../lib/language';

/** P1: example rows are never shown without this. Pink fill, black text, icon. */
export function ExampleBadge({ sticky = false }: { sticky?: boolean }) {
  const { t } = useCopy();
  return <ExampleLabel sticky={sticky}>{t.history.exampleBadge}</ExampleLabel>;
}
