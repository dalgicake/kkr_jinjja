import { useLocation } from 'react-router';
import { TextLink } from '../../components/common/TextLink';
import { copy } from '../../lib/i18n';
import { isDebugSearch } from '../capture/latencyLog';
import { ConnectionStatus } from './ConnectionStatus';
import { LatencyDebug } from './LatencyDebug';

export function AboutPage() {
  const { search } = useLocation();
  return (
    <section className="flex flex-col gap-6 pt-10">
      <h1 className="text-[22px] font-extrabold">{copy.about.title}</h1>
      <ConnectionStatus />
      {isDebugSearch(search) && <LatencyDebug />}
      <TextLink to="/">{copy.about.back}</TextLink>
    </section>
  );
}
