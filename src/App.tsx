import { BrowserRouter, Outlet, Route, Routes } from 'react-router';
import { Footer } from './components/common/Footer';
import { HomePage } from './features/home/HomePage';
import { AuthProvider } from './lib/auth';
import { LanguageProvider } from './lib/language';
import { ROUTES } from './routes';

function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4">
      <main className="flex flex-col">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              {ROUTES.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
              <Route path="*" element={<HomePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
