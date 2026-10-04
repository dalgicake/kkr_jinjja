# CHANGELOG

## v0.001 — 2026-10-04

- Phase 0 셋업: Vite + React + TypeScript(strict) + Tailwind CSS + React Router + Vitest + ESLint/Prettier.
- 디자인 토큰(Paper/Ink/Receipt/Lime/Pink/Muted), Pretendard Variable, 가격 tabular-nums.
- 홈: 앱 이름, 준비 중 안내, 수수료 문구(P7), 하단 버전 표시 `v0.001`.
- `vercel.json`(icn1, maxDuration 30, `/api/*` 제외 SPA 폴백), `/api/health`(shared/units import).
- `shared/types.ts`, `shared/units.ts`(단위가격 기준 ml·g=100, m=10, sheet=100, ea=1) + 테스트.
- `supabase/migrations/0001_init.sql`, 첫 방문 시 익명 로그인. 키가 없으면 "연결 안 됨" 상태로 표시.
- 빌드 후 `dist/`의 서버 키 이름·값 검사 스크립트(`npm run check:keys`).
