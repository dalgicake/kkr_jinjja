import { TextLink } from '../../components/common/TextLink';
import { copy } from '../../lib/i18n';
import { ConnectionStatus } from './ConnectionStatus';

export function AboutPage() {
  return (
    <section className="flex flex-col gap-6 pt-10">
      <h1 className="text-[22px] font-extrabold">{copy.about.title}</h1>
      <ConnectionStatus />
      <TextLink to="/">{copy.about.back}</TextLink>
    </section>
  );
}
