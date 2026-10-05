import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import banned from '../../../scripts/banned-words.json';
import { en } from '../../copy/en';
import { ko } from '../../copy/ko';
import { AuthProvider } from '../../lib/auth';
import type { Lang } from '../../lib/i18n';
import { LanguageProvider } from '../../lib/language';
import { HomePage } from '../home/HomePage';
import { AccountPage } from './AccountPage';

const render = (node: React.ReactNode, lang: Lang = 'en') =>
  renderToString(
    <LanguageProvider initialLang={lang}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/account']}>{node}</MemoryRouter>
      </AuthProvider>
    </LanguageProvider>,
  );

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

describe('/account (no Supabase env in tests)', () => {
  it('lilac header, "not connected" instead of fake account data, language toggle', () => {
    const html = render(<AccountPage />);
    expect(html).toContain(en.account.title);
    expect(html).toContain('bg-lilac');
    expect(html).toContain('data-testid="account-not-connected"');
    expect(html).toContain(esc(en.account.status.notConnected));
    expect(html).toContain(en.account.language.title);
    expect(html).toContain('data-testid="language-toggle"');
    // nothing that needs a session is offered
    expect(html).not.toContain(en.account.signOut.button);
    expect(html).not.toContain(en.account.remove.start);
    expect(html).not.toContain('data-testid="provider-google"');
  });

  it('Korean copy and no banned P4 words', () => {
    const koHtml = render(<AccountPage />, 'ko');
    expect(koHtml).toContain(ko.account.title);
    for (const html of [koHtml, render(<AccountPage />)].map((h) => h.toLowerCase()))
      for (const w of banned.words) expect(html).not.toContain(w.toLowerCase());
  });

  it('is linked from home', () => {
    expect(render(<HomePage />)).toContain('href="/account"');
  });
});
