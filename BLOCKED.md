# BLOCKED.md

사람(기령·팀원)이 해야 해서 멈춘 일. 해결되면 줄을 지우지 말고 [해결]로 바꾼다.

## 템플릿
- [ ] 무엇이 필요한가:
  - 어떻게 하면 되는가(클릭 순서까지):
  - 그동안 진행하는 다른 작업:

---

## Phase 0 (2026-10-04 기록)

### 1순위 — 이것부터 해야 다른 것도 풀린다

- [해결] **B0-0 GitHub push 권한** (2026-10-04 협업자 추가 후 push 성공) — `git push`가 403으로 거절됨. 저장소 `dalgicake/kkr_jinjja`의 주인은 `dalgicake` 계정인데, 이 맥에 로그인된 계정은 `dalgicake8`이라 쓰기 권한이 없다. 커밋은 로컬에 쌓아 두고 있다.
  - 어떻게 하면 되는가 (A안 추천: 협업자 추가)
    1. 브라우저에서 **dalgicake** 계정으로 로그인 → https://github.com/dalgicake/kkr_jinjja
    2. 상단 탭 **Settings** → 왼쪽 메뉴 **Collaborators** (비밀번호·2FA를 다시 물으면 입력)
    3. **Add people** → `dalgicake8` 입력 → 목록에서 선택 → **Add dalgicake8 to this repository**
    4. 이번엔 **dalgicake8** 계정으로 → https://github.com/notifications 또는 받은 메일에서 초대 열기 → **Accept invitation**
    5. 채팅에 "push 권한 줬어"라고 알려 주면 Claude가 `git push -u origin main`을 다시 실행한다.
  - B안: 터미널에서 `! gh auth login` → GitHub.com → HTTPS → 브라우저 로그인에서 **dalgicake** 계정 선택. (이 맥의 기본 계정이 바뀌니 다른 프로젝트 push에도 영향이 있다.)
  - 그동안: 모든 [C] 작업을 로컬 커밋으로 계속한다.

### H0-1 계정·키 (PLAN 14장)

- [해결] **B0-1 Supabase 프로젝트** (2026-10-05) — 계정 devvingcheshire@gmail.com, 프로젝트 "devvingcheshire@gmail.com's Project"(ref `kagzhfhhuwcuwncmxayu`, 리전 도쿄 ap-northeast-1 — 서울 아님, 기령이 그대로 쓰기로 결정). CLI 로그인 후 Claude가 익명 로그인 켜기·마이그레이션 0001 적용·비공개 버킷 test-photos 생성·로컬 .env.local 작성까지 하고 확인(테이블 9개, search_products, 익명 가입, RLS). 같은 이름의 10/4 프로젝트(ref wdybxgop…)는 비어 있고 손대지 않음.
  - 어떻게 하면 되는가
    1. https://supabase.com/dashboard → 로그인 → **New project**
    2. Name `kkr-jinjja` / Database Password는 **Generate**로 만들고 비밀번호 관리자에 저장 / Region **Northeast Asia (Seoul)** → **Create new project** (2분쯤 기다림)
    3. 왼쪽 **Authentication** → **Sign In / Providers**(또는 Settings) → **Allow anonymous sign-ins** 켜기 → **Save changes**
    4. 왼쪽 **Storage** → **New bucket** → 이름 `test-photos`, **Public bucket은 끈 채로** → **Create bucket**
    5. 왼쪽 **SQL Editor** → **New query** → 저장소의 `supabase/migrations/0001_init.sql` 내용을 전부 붙여 넣기 → **Run** → "Success. No rows returned"면 성공 (C0-3)
    6. 왼쪽 아래 **Project Settings** → **API Keys**(또는 **Data API**) → 아래 세 값을 **B0-4 Vercel**과 로컬 `.env.local`에 넣는다. (화면에 "Legacy API keys" 탭이 있으면 거기의 `anon`·`service_role`을 쓴다.)
       - Project URL → `SUPABASE_URL`, `VITE_SUPABASE_URL`
       - anon public → `VITE_SUPABASE_ANON_KEY`
       - service_role (Reveal) → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ 절대 채팅·코드·스크린샷에 올리지 않기
  - 그동안: 마이그레이션 SQL, 익명 로그인 코드(`src/lib/supabase.ts`)를 미리 만들어 둔다. 키가 없으면 앱은 "연결 안 됨" 상태로 뜬다.

- [ ] **B0-2 Anthropic API 키** (부모님 계정, 약 5분)
  - 어떻게 하면 되는가
    1. https://console.anthropic.com → 부모님 계정 로그인
    2. 왼쪽 아래 **Settings** → **Workspaces** → **Create Workspace** → 이름 `kkr-jinjja` → **Create**
    3. 방금 만든 워크스페이스 → **Limits** → 월 사용 한도(Spend limit)를 **$20**으로 → 저장
    4. **Settings → API Keys** → **Create Key** → Workspace `kkr-jinjja` 선택, 이름 `kkr-jinjja-vercel` → **Add** → 키는 한 번만 보이니 바로 복사 → `ANTHROPIC_API_KEY`
  - 그동안: Phase 0에는 키가 필요 없다. Phase 1의 `/api/read-tag`부터 쓴다.

- [ ] **B0-3 네이버 검색 API** (약 5분)
  - 어떻게 하면 되는가
    1. https://developers.naver.com → 로그인 → 위 메뉴 **Application** → **애플리케이션 등록**
    2. 애플리케이션 이름 `진짜` → 사용 API 드롭다운에서 **검색** 선택
    3. 비로그인 오픈 API 서비스 환경 → **WEB 설정** → 웹 서비스 URL에 Vercel 주소(B0-4 뒤에 생김. 아직 없으면 `http://localhost:5173`을 넣고 나중에 **내 애플리케이션 → API 설정**에서 수정)
    4. **등록하기** → **내 애플리케이션** → 개요에서 **Client ID** → `NAVER_CLIENT_ID`, **Client Secret**(보기) → `NAVER_CLIENT_SECRET`
  - 그동안: Phase 2 전까지는 필요 없다.

- [ ] **B0-4 Vercel 연결과 환경 변수** (B0-0 다음, 약 10분)
  - 어떻게 하면 되는가
    1. https://vercel.com → **Sign Up / Log in** → **Continue with GitHub** (저장소 주인인 `dalgicake` 계정)
    2. 대시보드 **Add New…** → **Project** → 목록에서 `kkr_jinjja` 옆 **Import** (안 보이면 **Adjust GitHub App Permissions**에서 이 저장소 허용)
    3. Framework Preset이 **Vite**인지 확인. Build Command, Output Directory는 그대로 둔다
    4. **Environment Variables**를 펼치고 아래를 하나씩 추가 (모르는 값은 비워 두고 나중에 **Settings → Environment Variables**에서 추가해도 된다)
       ```
       ANTHROPIC_API_KEY        (B0-2)
       MODEL_TAG                claude-sonnet-5-5
       MODEL_CLASSIFY           claude-sonnet-5-5
       NAVER_CLIENT_ID          (B0-3)
       NAVER_CLIENT_SECRET      (B0-3)
       SUPABASE_URL             (B0-1)
       SUPABASE_SERVICE_ROLE_KEY(B0-1)
       ADMIN_PASSCODE           (직접 정한 숫자·문자 12자 이상)
       USD_KRW                  1400
       VITE_SUPABASE_URL        (B0-1, SUPABASE_URL과 같은 값)
       VITE_SUPABASE_ANON_KEY   (B0-1)
       ```
    5. **Deploy** → 끝나면 나오는 `https://kkr-jinjja-….vercel.app` 주소를 채팅에 알려 준다
    6. (선택) 이 맥에서 프리뷰 배포를 Claude가 하게 하려면: 터미널에서 `! npx vercel login` → 같은 계정으로 로그인 → `! npx vercel link` → 기존 프로젝트 `kkr-jinjja` 선택
  - 그동안: `vercel.json`(icn1, maxDuration 30), `/api/health`를 만들고 로컬 빌드·테스트로 확인해 둔다. Phase 0 수용 기준(폰에서 HTTPS, v0.001, health OK, 익명 user id)은 배포 뒤에 확인한다.

### H0-2, H0-3 (마트·집에서)

- [ ] **B0-5 마트 가격표 사진 25~30장** (20분, 가능하면 매장 두 곳)
  - 어떻게 하면 되는가: 세탁·주방·욕실·종이·가공식품·음료를 골고루, **행사 가격표 5장 이상**, 반사되거나 기울어진 사진도 몇 장. 가격표만 찍고 사람·진열 전체는 찍지 않는다. 파일 이름은 `001.jpg, 002.jpg …`로 해서 `fixtures/tags/`에 넣는다(또는 다운로드 폴더에 `kkr_tags` 폴더로 두고 알려 주기). 데모로 쓸 만한 사진은 번호를 따로 적어 둔다.
  - 그동안: Phase 1 코드(촬영·압축·read-tag)를 먼저 만든다. 평가(C1-5)만 사진이 있어야 한다.

- [ ] **B0-6 상품 30개 목록** (PLAN 부록 B 형식)
  - 어떻게 하면 되는가: 집에 있는 실제 제품을 보며 `products.csv`를 채운다. 세탁 5 / 주방 3 / 욕실 5 / 종이 4 / 가공식품 8 / 음료 5, 바코드 숫자까지. 신선식품·주류·의약품은 빼기. 예시 줄은 PLAN.md 부록 B. 다 되면 저장소 최상위 `products.csv`로 넣거나 다운로드 폴더에 두고 알려 준다.
  - 그동안: Phase 2의 파서와 판정 로직(부록 A·D 테스트)을 먼저 만든다.
