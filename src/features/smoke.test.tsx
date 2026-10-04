import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Footer } from '../components/common/Footer';
import { ko } from '../copy/ko';
import { AuthProvider } from '../lib/auth';
import { AboutPage } from './about/AboutPage';
import { HomePage } from './home/HomePage';

const render = (node: React.ReactNode) =>
  renderToString(
    <AuthProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </AuthProvider>,
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
