import type { ReactElement } from 'react';
import { AboutPage } from './features/about/AboutPage';
import { AccountPage } from './features/account/AccountPage';
import { AdminPage } from './features/admin/AdminPage';
import { ConfirmPage } from './features/confirm/ConfirmPage';
import { DemoPage } from './features/demo/DemoPage';
import { FieldTestPage } from './features/fieldtest/FieldTestPage';
import { HistoryPage } from './features/history/HistoryPage';
import { ResultPage } from './features/result/ResultPage';
import { ScreensPage } from './features/screens/ScreensPage';
import { StatsPage } from './features/stats/StatsPage';

/**
 * Every route except Home (index) and the catch-all, both in App.tsx. /screens lists them all;
 * keep features/screens/tour.ts in step when adding one.
 */
export const ROUTES: readonly { path: string; element: ReactElement }[] = [
  { path: 'confirm', element: <ConfirmPage /> }, // S2
  { path: 'result', element: <ResultPage /> }, // S3, first example
  { path: 'preview/result/:type', element: <ResultPage /> }, // S3, fixture id or PLAN 9 type
  { path: 'history', element: <HistoryPage /> }, // S4
  { path: 'demo', element: <DemoPage /> }, // S5, ?s=D1..D3&step=1..3
  { path: 'test', element: <FieldTestPage /> }, // S6
  { path: 'admin', element: <AdminPage /> }, // S7
  { path: 'stats', element: <StatsPage /> }, // S8
  { path: 'about', element: <AboutPage /> }, // S9
  { path: 'account', element: <AccountPage /> }, // S10
  { path: 'screens', element: <ScreensPage /> }, // screen tour
];
