import { TextLink } from '../../components/common/TextLink';
import { copy } from '../../lib/i18n';

export function HomePage() {
  return (
    <section className="flex flex-col gap-4 pt-10">
      <h1 className="text-[30px] font-extrabold leading-tight">{copy.app.name}</h1>
      <p className="text-[17px]">{copy.app.tagline}</p>
      <p className="text-[15px] text-muted">{copy.home.comingSoon}</p>
      <TextLink to="/about">{copy.home.aboutLink}</TextLink>
    </section>
  );
}
