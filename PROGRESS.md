# PROGRESS.md

Phase가 끝날 때마다 맨 위에 추가한다.

### Phase 0 — 셋업과 첫 배포 (v0.001, 2026-10-04) — 진행 중: [C] 완료, 배포·수용 기준은 [H] 대기
- 한 일: C0-1 Vite+React+TS(strict)+Tailwind+Router+Vitest+ESLint/Prettier, PLAN 4장 폴더, version.ts(0.001)·updateLogs·CHANGELOG·하단 버전 배지, 홈에 P7 수수료 문구, 문구는 src/copy/ko·en만. C0-2 vercel.json(icn1, maxDuration 30, /api 제외 SPA 폴백), api/health.ts가 shared/units.ts import. C0-3 supabase/migrations/0001_init.sql(PLAN 5장과 동일), 첫 방문 signInAnonymously(키 없으면 "연결 안 됨" 표시, 가짜 id 없음). scripts/check-keys.mjs(dist/에서 서버 키 이름·값 검사), check-words(최저가 등 금지어).
- 수치: `npm run check` 통과 — typecheck 0, lint 0, 테스트 25/25, build OK, check:keys OK. api/health를 plain Node로 실행해 `200 {"ok":true,"version":"0.001"}` 확인. 배포 환경 수용 기준(폰 HTTPS, 배포된 /api/health, 실제 익명 user id)은 미확인 — B0-0·B0-1·B0-4 대기.
- Verifier 점검: 4개 관점(수용 기준 / P1~P7·문구 / 키 노출 / 코드 규칙) 2라운드. 1라운드 실패 5건(동적 import 미차단, 링크 터치 폭 48px 미만 2곳, src/에 '최저가' 글자, 하드코딩 영문 오류 문구) 수정 → 2라운드 4개 관점 모두 통과. 배포 전이라 Phase 0 완료로 표시하지 않음.
- 남은 일: push(B0-0) → Vercel import·env(B0-4) → Supabase 마이그레이션·익명 로그인(B0-1) → 폰에서 수용 기준 확인. 첫 배포 때 /api/health가 실패하면 루트 tsconfig.json에 compilerOptions(module NodeNext) 추가부터 시도.
- 제안(범위 밖, 구현 안 함): Vercel 빌드 명령에 check:keys 포함(값 검사가 실제 env에서 돌도록) / /api/health에 env 존재 여부(boolean만) 표시.

## 템플릿
### Phase N — 제목 (vX.XXX, YYYY-MM-DD HH:MM)
- 한 일:
- 수치(수용 기준 대비):
- Verifier 점검: 수용 기준 / 원칙 P1~P7 / 키 노출 — 통과·실패 사유
- 남은 일:
- 제안(범위 밖, 구현 안 함):
