import { BrowserRouter, Outlet, Route, Routes } from 'react-router';
import { Footer } from './components/common/Footer';
import { AboutPage } from './features/about/AboutPage';
import { ConfirmPage } from './features/confirm/ConfirmPage';
import { HomePage } from './features/home/HomePage';
import { AuthProvider } from './lib/auth';

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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="confirm" element={<ConfirmPage />} />
            <Route path="*" element={<HomePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
