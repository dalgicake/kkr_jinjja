export interface UpdateLog {
  version: string;
  date: string; // YYYY-MM-DD
  notes: string[];
}

/** 최신이 맨 앞. 내부 기록용(화면 문구 아님). */
export const updateLogs: UpdateLog[] = [
  {
    version: '0.001',
    date: '2026-10-04',
    notes: [
      'Phase 0 setup: Vite + React + TS + Tailwind + Router + Vitest',
      'vercel.json (icn1, maxDuration 30), /api/health importing shared/units',
      'Supabase migration 0001, anonymous sign-in on first visit',
    ],
  },
];
