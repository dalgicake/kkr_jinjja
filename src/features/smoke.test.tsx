import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Footer } from '../components/common/Footer';
import { en } from '../copy/en';
import { ko } from '../copy/ko';
import { AuthProvider } from '../lib/auth';
import { fill } from '../lib/i18n';
import { LanguageProvider } from '../lib/language';
import { AboutPage } from './about/AboutPage';
import { LatencyDebug } from './about/LatencyDebug';
import { HomePage } from './home/HomePage';

const render = (node: React.ReactNode) =>
  renderToString(
    <LanguageProvider initialLang="ko">
      <AuthProvider>
        <MemoryRouter>{node}</MemoryRouter>
      </AuthProvider>
    </LanguageProvider>,
  );

describe('Phase 0 screens (no Supabase env)', () => {
  it('home shows app name, P7 notice and v0.001', () => {
    const html = render(
      <>
        <HomePage />
        <Footer />
      </>,
    );
    expect(html).toContain(ko.app.name);
    expect(html).toContain(ko.commission);
    expect(html).toContain('v0.001');
  });
  it('about?debug shows the shutter → card latency read-out; plain /about does not', () => {
    const at = (url: string) =>
      renderToString(
        <LanguageProvider initialLang="ko">
          <AuthProvider>
            <MemoryRouter initialEntries={[url]}>
              <AboutPage />
            </MemoryRouter>
          </AuthProvider>
        </LanguageProvider>,
      );
    expect(at('/about?debug')).toContain(ko.about.latency.title);
    expect(at('/about?debug')).toContain(ko.about.latency.none); // no samples on the server
    expect(at('/about')).not.toContain(ko.about.latency.title);
    const html = renderToString(
      <LanguageProvider initialLang="ko">
        <LatencyDebug samples={[4000, 7000, 5000]} />
      </LanguageProvider>,
    );
    expect(html).toContain(fill(ko.about.latency.median, { n: 3, ms: 5000 }));
    expect(html).toContain(fill(ko.about.latency.last, { ms: 5000 }));
  });
  it('about shows "not connected" instead of crashing or faking an id', () => {
    const html = render(<AboutPage />);
    expect(html).toContain(ko.auth.notConnected);
    expect(html).not.toContain('anon-user-id');
  });
  it('text links have a 48x48px hit box', () => {
    for (const html of [render(<HomePage />), render(<AboutPage />)]) {
      const anchor = html.match(/<a [^>]*>/)?.[0] ?? '';
      expect(anchor).toContain('min-h-12');
      expect(anchor).toContain('min-w-12');
    }
  });
});

describe('language', () => {
  const plain = (node: React.ReactNode) =>
    renderToString(
      <AuthProvider>
        <MemoryRouter>{node}</MemoryRouter>
      </AuthProvider>,
    );
  it('English is the default (no provider choice, no stored value)', () => {
    const html = plain(
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>,
    );
    expect(html).toContain(en.home.cta);
    expect(html).not.toContain(ko.home.cta);
  });
  it('every screen header carries the EN / 한국어 toggle with the active side pressed', () => {
    for (const page of [<HomePage key="h" />, <AboutPage key="a" />]) {
      const html = plain(<LanguageProvider initialLang="ko">{page}</LanguageProvider>);
      expect(html).toContain('data-testid="language-toggle"');
      expect(html).toMatch(/lang="ko" aria-pressed="true"/);
      expect(html).toMatch(/lang="en" aria-pressed="false"/);
      expect(html).toContain('>EN<');
      expect(html).toContain('>한국어<');
    }
  });
  it('about lists all seven principles in the chosen language', () => {
    const html = plain(
      <LanguageProvider initialLang="en">
        <AboutPage />
      </LanguageProvider>,
    );
    for (const k of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] as const)
      expect(html).toContain(
        en.about.principles[k].title.replace(/"/g, '&quot;').replace(/'/g, '&#x27;'),
      );
  });
});
