# PROGRESS.md

Phase가 끝날 때마다 맨 위에 추가한다.

### Phase 1 — 가격표 읽기 (코드만, 미배포, 2026-10-05) — 진행 중: [C] 코드 완료, 수용 기준은 키·사진 대기
- 한 일: C1-1 촬영·압축(긴 변 1568px, JPEG 0.85, EXIF), C1-2 사진 속 바코드(barcode-detector, EAN/UPC 체크디지트 검증), C1-3 `/api/read-tag`(토큰 검증, 시간당 60회 — 병렬 요청 우회를 막도록 호출 전에 슬롯 예약, zod 검증 1회 재시도 후 422, api_calls 기록, test 모드만 사진 저장), C1-4 확인 카드 S2(필수 필드, 신뢰도 0.7 미만 분홍 배지+글자, 단위가격 교차검증, 매장 칩, 큐레이션 칩, corrections), C1-5 `npm run eval:tags`(+ `--draft`로 정답 초안 NNN.draft.json — 정답 NNN.json은 기령이 사진 보며 직접).
- PLAN과 다른 점: PLAN 7.1의 강제 tool 호출(`tool_choice: tool`)은 claude-sonnet-5-5·opus-5-5에서 400으로 거절된다(Anthropic 문서 확인). 그래서 `auto` + record_tag 하나만 + 프롬프트 지시로 부르고, 도구 호출이 없으면 검증 실패로 처리(1회 재시도 후 422, 추측값 없음). haiku-4-5는 강제 호출 유지. `strict: true`는 실제 키로 확인한 뒤 붙인다.
- 수치: `npm run check` 통과 — 테스트 300/300, typecheck·lint 0, check:keys·check:words OK. API 함수 2개(health, read-tag). 정확도(매장가 ≥95%, 브랜드 ≥85%, 용량+수량 ≥85%)와 셔터→확인 카드 중앙값 ≤6초는 미측정 — Anthropic 키(B0-2)와 가격표 사진·정답(B0-5, H1-1)이 있어야 함.
- Verifier 점검: 4개 관점 3라운드. 1라운드 실패 8건(서버측 파생값 미계산, 셔터→카드 시간 기록 없음, 바코드가 다른 가격표의 상품으로 덮어쓰며 "확인된 상품" 표시(P1/P2), 60회 제한 병렬 우회, 미인증 503에 env 이름 노출, 500줄 초과 파일, Supabase 장애를 401로 표시 등) → 수정 → 2라운드 1건(바코드-판독 불일치 처리) → 수정 → 3라운드 통과. 남은 사소한 1건(서버 미설정 503에 [다시 찍기] 안내)은 직접 고침.
- 남은 일: 배포(B0-4) 후 폰에서 촬영→확인 카드 확인, Anthropic 키로 eval:tags 실행 → 표를 여기에. 미달이면 프롬프트 수정·재평가를 시도마다 기록.
- 제안(범위 밖, 구현 안 함): 사진 속 바코드를 read-tag 요청에도 보내 scans.barcode 채우기(Phase 2 선조회와 함께) / eval 실행 비용도 api_calls에 기록.

### Phase 0 — 셋업과 첫 배포 (v0.001, 2026-10-04) — 진행 중: [C] 완료, 배포·수용 기준은 [H] 대기
- 한 일: C0-1 Vite+React+TS(strict)+Tailwind+Router+Vitest+ESLint/Prettier, PLAN 4장 폴더, version.ts(0.001)·updateLogs·CHANGELOG·하단 버전 배지, 홈에 P7 수수료 문구, 문구는 src/copy/ko·en만. C0-2 vercel.json(icn1, maxDuration 30, /api 제외 SPA 폴백), api/health.ts가 shared/units.ts import. C0-3 supabase/migrations/0001_init.sql(PLAN 5장과 동일), 첫 방문 signInAnonymously(키 없으면 "연결 안 됨" 표시, 가짜 id 없음). scripts/check-keys.mjs(dist/에서 서버 키 이름·값 검사), check-words(최저가 등 금지어).
- 수치: `npm run check` 통과 — typecheck 0, lint 0, 테스트 25/25, build OK, check:keys OK. api/health를 plain Node로 실행해 `200 {"ok":true,"version":"0.001"}` 확인. 배포 환경 수용 기준(폰 HTTPS, 배포된 /api/health, 실제 익명 user id)은 미확인 — B0-0·B0-1·B0-4 대기.
- Verifier 점검: 4개 관점(수용 기준 / P1~P7·문구 / 키 노출 / 코드 규칙) 2라운드. 1라운드 실패 5건(동적 import 미차단, 링크 터치 폭 48px 미만 2곳, src/에 '최저가' 글자, 하드코딩 영문 오류 문구) 수정 → 2라운드 4개 관점 모두 통과. 배포 전이라 Phase 0 완료로 표시하지 않음.
- 남은 일: [해결] push(B0-0), [해결] Supabase(B0-1: 도쿄 리전, 마이그레이션·익명 로그인·버킷 적용, REST로 익명 user id 발급 확인) → Vercel import·env(B0-4) → 폰에서 수용 기준 확인. 첫 배포 때 /api/health가 실패하면 루트 tsconfig.json에 compilerOptions(module NodeNext) 추가부터 시도.
- 제안(범위 밖, 구현 안 함): Vercel 빌드 명령에 check:keys 포함(값 검사가 실제 env에서 돌도록) / /api/health에 env 존재 여부(boolean만) 표시.

## 템플릿
### Phase N — 제목 (vX.XXX, YYYY-MM-DD HH:MM)
- 한 일:
- 수치(수용 기준 대비):
- Verifier 점검: 수용 기준 / 원칙 P1~P7 / 키 노출 — 통과·실패 사유
- 남은 일:
- 제안(범위 밖, 구현 안 함):
