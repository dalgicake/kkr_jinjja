# 진짜? (가제) — MVP v0.1 PLAN

마트 매대 앞에서 가격표를 한 장 찍으면 온라인의 같은 상품과 비교해 "온라인이 진짜 싼지"를 근거와 함께 보여 주고, 사용자가 확인한 구매만 기록하는 모바일 웹앱(PWA).

- 근거: 「모두의 창업」 2차 지원서(김기령) Q4-1의 2단계 '시제품' 전체 + 4단계 '재구매' 중 구매 기록 부분.
- 이 파일이 범위의 단일 기준이다. 범위 밖 아이디어는 만들지 말고 PROGRESS.md의 '제안'에 한 줄로 적는다.
- [C] = Claude Code가 하는 일, [H] = 사람(기령·팀원)이 해야 하는 일. [H]에서 막히면 BLOCKED.md에 적고 다른 [C] 작업을 계속한다.

---

## 0. v0.1 완료 기준

1. 배포된 HTTPS 주소를 폰에서 열어, **실제 마트에서** 가격표를 찍으면 판정 화면까지 간다.
2. 판정 화면이 1장의 원칙 P1~P7을 전부 지킨다.
3. 스캔·수정·판정·구매 확인·API 비용이 기록되고 /stats에 보인다.
4. /demo가 비행기 모드에서도 세 가지 시나리오를 끝까지 재생한다.
5. shared/의 파서·분류·판정 테스트가 전부 통과한다.

---

## 1. 원칙 — 지원서에 쓴 약속. 기능과 충돌하면 원칙이 이긴다

- **P1 미확인은 미확인으로.** 읽지 못했거나 조회되지 않은 값은 "미확인"이라고 쓴다. 추정값을 사실처럼 보이지 않는다. 배송비는 v0.1에서 항상 미확인이다.
- **P2 불확실하면 추천하지 않는다.** 규격이 같은지 확실하지 않은 상품은 판정에 쓰지 않고 '확인 필요' 칸에만 둔다. 분류가 애매하면 언제나 더 보수적인 칸으로 내린다.
- **P3 마트가 싸면 그대로 말한다.** 그때 온라인 링크를 강조하지 않는다.
- **P4 "최저가"라는 말을 쓰지 않는다.** 대신 조회 범위와 조회 시각을 문장으로 항상 보여 준다.
- **P5 구매는 사용자가 확인한 것만.** 촬영·검색·클릭은 구매가 아니다. "온라인으로 살게요"는 '구매 예정'이고, 사용자가 나중에 [샀어요]를 눌러야 구매가 된다.
- **P6 온라인 가격은 매번 새로 조회한다.** 화면의 온라인 가격은 방금 조회한 값(서버 캐시 최대 10분)이며 조회 시각을 함께 보인다. 온라인 가격 목록을 DB에 쌓지 않는다. 저장하는 것은 ① 우리가 확인한 '상품 연결 정보' ② 사용자가 확인한 구매 기록 ③ 지표용 요약(판정·차액)뿐이다.
- **P7 v0.1에는 제휴 링크·광고가 없다.** 화면에 "이 앱은 지금 어떤 판매처에서도 수수료를 받지 않아요"를 표시한다.

---

## 2. 화면과 흐름

### S0 홈 `/`
- 가장 큰 버튼은 [가격표 찍기]. 엄지가 닿는 화면 아래쪽, 가격표 모양(13장).
- 보조 동작: [바코드로 찾기] [직접 입력] [데모로 체험].
- 오늘의 매장 칩: 이마트 / 홈플러스 / 롯데마트 / 메가마트 / 노브랜드 / 하나로마트 / 기타(입력). 마지막 선택을 기억한다. 고르지 않아도 진행된다.
- 최근 기록 3개. '구매 예정(온라인)'이 있으면 그 줄에 [샀어요] 버튼.
- 맨 아래: P7 수수료 문구, 버전 표시(`v0.001`).

### S1 촬영
- `<input type="file" accept="image/*" capture="environment">`로 기본 카메라를 연다(iOS·안드로이드 공통으로 가장 안정적).
- 카메라를 열기 전 한 줄 안내: "가격표가 화면을 꽉 채우게, 반사 없이 찍어 주세요."
- 사진이 선택된 순간을 t0으로 기록 → 브라우저에서 압축(긴 변 1568px, JPEG 0.85, EXIF 회전 반영) → 병렬로
  (a) 사진 속 바코드 디코딩(`barcode-detector` 폴리필, EAN-13/EAN-8/UPC/Code128)
  (b) `/api/read-tag` 업로드.
- 바코드가 큐레이션 상품과 일치하면 OCR을 기다리지 않고 그 규격으로 `/api/compare` 선조회를 바로 시작한다(가격만 OCR에서 받음).
- S1b 라이브 바코드 스캔(getUserMedia + 같은 폴리필, 초당 약 8회 검사)은 시간이 남으면.

### S2 확인 카드 — "이 상품 맞아요?"
- 필드: 브랜드 / 제품명 / 종류(향·맛 등) / 개당 용량+단위 / 수량 / 매장가 / 행사 정보.
- 필수: 브랜드, 제품명, 개당 용량+단위(단위가 `ea`면 용량 생략 가능), 수량, 매장가. 비어 있으면 그 칸에 포커스.
- 신뢰도 0.7 미만인 필드는 분홍 테두리 + "확인해 주세요" 글자(색만으로 표시하지 않는다).
- 가격표 단위가격 교차검증: (매장가 ÷ 총용량)이 가격표에 인쇄된 단위가격과 5% 넘게 다르면 용량·수량 칸에 경고.
- 큐레이션 매칭: 바코드 일치 → "확인된 상품" 배지 + 확인된 규격으로 채움 / 이름 유사(`search_products`) → "혹시 이 상품?" 칩 최대 3개.
- 사용자가 고친 필드는 `corrections`에 (원래 값 → 고친 값)으로 기록.
- read-tag 결과가 오는 즉시 `/api/compare` **선조회(prefetch)**. 사용자가 [맞아요, 비교하기]를 누를 때는 대부분 결과가 와 있다. 규격 필드를 고치면 다시 조회.
- 실패 시: "가격표를 읽지 못했어요. 가격표가 화면을 꽉 채우게 다시 찍어 주세요." + [다시 찍기] [직접 입력].
- 사진이 상품 포장(`image_kind=product_package`)이면 매장가 입력 칸을 먼저 연다(숫자 키패드).

### S3 결과 — "비교 영수증"
1. **판정**(맨 위, 큰 글씨): 9장의 판정 유형 중 하나.
2. **비교 영수증**: 매장 줄(매장명, 가격, 단위가격) / 온라인 줄(판매처, 가격, 단위가격, "배송비 미확인") / 차액 / 손익분기 배송비.
3. **같은 상품으로 본 이유**(펼침): 브랜드 ✓, 제품 라인 ✓, 종류 ✓ 또는 ?, 개당 용량 ✓, 수량 ✓. 확인된 연결이면 배지.
4. **조회 문장**: "{시각}에 네이버 쇼핑 검색 결과 {n}개를 확인했어요. 쿠팡 가격은 아직 포함되지 않아요."
5. 아래 두 칸: **묶음·다른 용량**(단위가격으로만 비교, 총 결제액 함께) / **확인 필요**(판정에 쓰지 않음, 이유 표시).
6. 온라인 항목마다: [판매처에서 보기](outbound 이벤트), 작은 피드백 "같은 상품 맞아요 / 아니에요".
7. 지난번 구매가 있으면: "지난번엔 {날짜} {매장/온라인}에서 {가격}원에 샀어요."
8. 행사(1+1 등)가 감지되면 배너: "1+1 행사 중이에요. 2개 기준으로 비교할까요?" [2개 기준으로] — 토글, 판정 즉시 재계산.
9. 아래 고정 바: [마트에서 살게요] [온라인으로 살게요] [안 살래요]
   - 마트 → `purchases(status=confirmed)` + "다음엔 언제쯤?" (2주 / 1달 / 2달 / 건너뛰기) → `next_due_at`
   - 온라인 → `purchases(status=planned)`. 판매처 링크는 사용자가 따로 누른다.
   - 안 살래요 → 이벤트만 기록.
10. [결과가 이상해요] → 종류 선택(다른 상품 / 용량·수량이 다름 / 가격이 다름 / 기타) → `reports`.

### S4 기록 `/history`
- 맨 위: 구매 예정(온라인) → [샀어요]를 누르면 `status=confirmed`, 실제 결제가 입력(선택).
- 확인된 구매 목록(날짜, 매장/온라인, 가격), 다음 예정일이 가까운 순.

### S5 데모 `/demo` — 12장
### S6 실험 모드 `/test` — 11장
### S7 관리자 `/admin` (패스코드)
- CSV 업로드 → `products` upsert(바코드 기준, 바코드 없으면 brand+name+variant+용량+수량 기준).
- 상품별 [네이버 조회] → 후보마다 [같은 상품] [다른 용량] [틀림] → `product_links`.
- 신고 목록(`reports`) 확인 → 연결을 재확인하거나 `wrong` 처리.

### S8 지표 `/stats` (패스코드) — 10장
### S9 안내 `/about`
- 원칙 P1~P7을 쉬운 말로.
- 개인정보: 익명 ID만 사용, 가격표 사진은 분석 후 저장하지 않음(실험 모드는 예외 — 동의한 참가자의 가격표 사진만 비공개 저장), 문의 이메일.
- 데이터 출처: 네이버 쇼핑 검색 API.

---

## 3. 기술 구성

| 영역 | 선택 | 메모 |
|---|---|---|
| 프론트 | Vite + React + TypeScript(strict) + Tailwind CSS + React Router | 가족 스킬 구조(src/features, src/constants/version)와 맞춤 |
| PWA | vite-plugin-pwa | 홈 화면 설치, 앱 셸만 캐시(API 응답은 캐시 안 함) |
| 서버 | Vercel Functions(`api/`, Node), region `icn1`, maxDuration 30 | 모든 키는 서버에만. 함수 6개 이내 유지 |
| DB·인증 | Supabase(서울 리전) Postgres + 익명 로그인 + RLS + pg_trgm | 가입 없이 바로 사용, 기록은 사용자별 |
| 가격표 읽기 | Anthropic API `MODEL_TAG`(기본 `claude-sonnet-5-5`), 강제 tool 호출로 JSON | 출력은 zod로 검증 |
| 분류 보조 | `MODEL_CLASSIFY`(기본 `claude-sonnet-5-5`) | 지연·비용 측정 후 `claude-haiku-4-5-20251001` 비교 실험 |
| 온라인 가격 | 네이버 검색 API(쇼핑) `/v1/search/shop.json` | 승인 절차 없이 일 25,000회. 배송비 필드 없음 |
| 바코드 | `barcode-detector`(zxing-wasm 기반 폴리필) | iOS Safari 포함 |
| 검증·테스트 | zod, Vitest | 순수 로직은 전부 shared/에서 테스트 |
| 폰트 | Pretendard Variable(npm `pretendard`, dynamic subset) | 가격은 `tabular-nums` |

### 환경 변수
```
# 서버 전용 (Vercel env) — src/에서 절대 import 금지
ANTHROPIC_API_KEY=
MODEL_TAG=claude-sonnet-5-5
MODEL_CLASSIFY=claude-sonnet-5-5
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSCODE=
USD_KRW=1400

# 클라이언트
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 비용 계산 (server/anthropic.ts)
```ts
// USD per 1M tokens — 요금이 바뀌면 여기만 고친다
export const PRICES: Record<string, { in: number; out: number }> = {
  'claude-sonnet-5-5': { in: 2, out: 10 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-opus-5-5': { in: 4, out: 20 },
};
// cost_krw = (input_tokens*in + output_tokens*out) / 1e6 * USD_KRW
```
모든 모델 호출은 `api_calls`에 (endpoint, model, 토큰, cost_krw, ms, ok)로 남긴다. 스캔 1회 예상 비용은 20~40원이지만 추정치이므로 /stats의 실측값을 기준으로 판단한다.

---

## 4. 폴더 구조

```
kkr_jinjja/
├── api/                        # Vercel Functions (6개 이내)
│   ├── health.ts               # shared/ 함수 하나를 import — 번들링 문제를 첫날 드러내기
│   ├── read-tag.ts
│   ├── compare.ts
│   ├── stats.ts
│   └── admin/
│       ├── products.ts
│       └── links.ts
├── server/                     # api/에서만 import (키 사용 코드)
│   ├── anthropic.ts            # 클라이언트, 비용 계산, api_calls 기록
│   ├── auth.ts                 # Supabase access token 검증, 사용자당 시간당 60회 제한
│   ├── naver.ts
│   ├── classify.ts             # LLM 배치 분류
│   ├── supabaseAdmin.ts
│   └── prompts/{readTag.ts, classify.ts}
├── shared/                     # 클라이언트·서버 공용 순수 함수 (테스트 필수)
│   ├── types.ts
│   ├── units.ts                # 정규화, 단위가격, 표시 형식
│   ├── spec/parseSpec.ts       # 상품명 → 용량·수량
│   ├── match/combine.ts        # 파서 + LLM 합의 규칙
│   └── verdict/verdict.ts
├── src/
│   ├── App.tsx                 # 라우팅·레이아웃만 (100줄 이내)
│   ├── features/{capture, confirm, result, history, demo, fieldtest, admin, stats, about}/
│   ├── components/common/
│   ├── lib/{supabase.ts, events.ts, i18n.ts, image.ts, barcode.ts}
│   ├── copy/{ko.ts, en.ts}     # 모든 UI 문구는 여기에만
│   └── constants/{version.ts, updateLogs.ts}
├── supabase/migrations/0001_init.sql
├── fixtures/
│   ├── tags/                   # 마트 가격표 사진 + 정답 JSON (기령)
│   └── demo/                   # 데모 3종 녹화 응답
├── scripts/{eval-tags.ts, eval-match.ts, import-products.ts, record-demo.ts}
├── PLAN.md  CLAUDE.md  PROGRESS.md  BLOCKED.md  CHANGELOG.md
└── vercel.json                 # regions: ["icn1"], functions maxDuration 30
```

---

## 5. 데이터 모델 — `supabase/migrations/0001_init.sql`

```sql
create extension if not exists pg_trgm;

-- 확인된 상품 (큐레이션: 사람이 실물을 보고 입력)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text unique,
  brand text not null,
  name text not null,                    -- 브랜드·용량 제외 제품명
  variant text,                          -- 향·맛·종류
  category text not null,                -- 세탁/주방/욕실/종이/가공식품/음료
  per_item_amount numeric check (per_item_amount > 0),  -- unit='ea'면 null 허용
  per_item_unit text not null check (per_item_unit in ('ml','g','m','sheet','ea')),
  item_count int not null default 1 check (item_count > 0),
  search_query text,
  verified_by text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index products_search_trgm on public.products
  using gin ((brand || ' ' || name || ' ' || coalesce(variant, '')) gin_trgm_ops);

create or replace function public.search_products(q text)
returns setof public.products language sql stable as $$
  select * from public.products
  where similarity(brand || ' ' || name || ' ' || coalesce(variant, ''), q) > 0.3
  order by similarity(brand || ' ' || name || ' ' || coalesce(variant, ''), q) desc
  limit 3;
$$;

-- 실물 상품 ↔ 온라인 상품 연결 정보 (이 서비스의 핵심 자산. 가격은 저장하지 않는다)
create table public.product_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source text not null default 'naver',
  external_id text not null,             -- 네이버 productId
  title_snapshot text,
  relation text not null check (relation in ('same_item','size_diff','wrong')),
  per_item_amount numeric,
  per_item_unit text,
  item_count int,
  status text not null default 'verified'
    check (status in ('verified','user_confirmed','reported')),
  confirmations int not null default 0,
  reports int not null default 0,
  verified_by text,
  created_at timestamptz not null default now(),
  unique (product_id, source, external_id)
);

-- 스캔 요약 (서버가 service role로 기록)
create table public.scans (
  id uuid primary key,                   -- 클라이언트가 촬영 시점에 생성
  user_id uuid not null,
  mode text not null default 'normal' check (mode in ('normal','test','demo')),
  participant_code text,
  store_name text,
  product_id uuid references public.products(id),
  barcode text,
  ocr jsonb,
  confirmed_spec jsonb,
  store_price int,
  n_fetched int, n_same int, n_size int, n_uncertain int,
  verdict text,
  diff_krw int,
  image_path text,                       -- test 모드에서만
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  scan_id uuid,
  product_id uuid references public.products(id),
  product_label text not null,           -- 예: 다우니 실내건조 2.6L 1개
  spec jsonb,
  channel text not null check (channel in ('store','online')),
  status text not null check (status in ('confirmed','planned')),
  price_paid int,
  quantity int not null default 1,
  store_name text,
  purchased_at timestamptz,              -- confirmed가 될 때 채움
  next_due_at date,
  created_at timestamptz not null default now()
);

create table public.corrections (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  scan_id uuid,
  field text not null,
  from_value text,
  to_value text,
  created_at timestamptz not null default now()
);

create table public.reports (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  scan_id uuid,
  product_id uuid,
  external_id text,
  kind text not null check (kind in ('wrong_product','wrong_size','wrong_price','other')),
  note text,
  created_at timestamptz not null default now()
);

create table public.manual_trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  participant_code text not null,
  product_label text not null,
  order_in_session int,
  method_first text check (method_first in ('manual','app')),
  manual_ms int,
  manual_outcome text check (manual_outcome in ('found_same','found_unsure','gave_up')),
  manual_app_used text,                  -- 쿠팡/네이버/마트앱/기타
  manual_price int,
  app_scan_id uuid,
  trust_pick text check (trust_pick in ('manual','app','same')),
  created_at timestamptz not null default now()
);

create table public.events (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  scan_id uuid,
  name text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_name_time on public.events (name, created_at);

create table public.api_calls (
  id bigserial primary key,
  user_id uuid,
  scan_id uuid,
  endpoint text not null,                -- read-tag / classify / naver
  model text,
  input_tokens int,
  output_tokens int,
  cost_krw numeric(10,2),
  ms int,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
create index api_calls_scan on public.api_calls (scan_id);
create index api_calls_user_time on public.api_calls (user_id, created_at);

-- RLS
alter table public.products      enable row level security;
alter table public.product_links enable row level security;
alter table public.scans         enable row level security;
alter table public.purchases     enable row level security;
alter table public.corrections   enable row level security;
alter table public.reports       enable row level security;
alter table public.manual_trials enable row level security;
alter table public.events        enable row level security;
alter table public.api_calls     enable row level security;   -- 정책 없음 = 서버 전용

create policy products_select   on public.products      for select using (true);
create policy links_select      on public.product_links for select using (true);
create policy scans_select_own  on public.scans         for select using (user_id = auth.uid());
create policy purchases_own     on public.purchases     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy corrections_ins   on public.corrections   for insert with check (user_id = auth.uid());
create policy reports_ins       on public.reports       for insert with check (user_id = auth.uid());
create policy trials_own        on public.manual_trials for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy events_ins        on public.events        for insert with check (user_id = auth.uid());
```
Storage: 비공개 버킷 `test-photos` — 서버(service role)만 업로드.

---

## 6. API 계약

모든 사용자 요청은 `Authorization: Bearer <Supabase access token>`. 서버가 `auth.getUser(token)`으로 검증하고, `api_calls` 기준 사용자당 시간당 60회를 넘으면 429.

### 공용 타입 (`shared/types.ts`)
```ts
export type Unit = 'ml' | 'g' | 'm' | 'sheet' | 'ea';
// 정규화: L→ml(×1000), kg→g(×1000). m = 휴지 롤당 길이, sheet = 물티슈 팩당 매수, ea = 개수로만 세는 상품

export interface TargetSpec {
  brand: string;
  productName: string;
  variant: string | null;
  perItemAmount: number | null;  // perItemUnit이 'ea'일 때만 null 허용
  perItemUnit: Unit;
  itemCount: number;             // 매장가로 사는 개수 (30롤 → 30)
}

export interface Promo {
  type: 'none' | 'n_plus_m' | 'percent_off' | 'card_discount' | 'multi_buy' | 'other';
  text: string | null;
  n?: number;                    // 1+1 → n=1, m=1 / 2+1 → n=2, m=1
  m?: number;
}

export type Relation = 'SAME_ITEM' | 'SIZE_DIFF' | 'UNCERTAIN';   // OTHER는 응답에서 뺀다

export interface Candidate {
  externalId: string;
  title: string;                 // HTML 태그·엔티티 정리됨
  mallName: string;
  isCatalog: boolean;            // productType '1' = 네이버 가격비교 묶음(여러 판매처 중 가장 싼 값)
  link: string;
  image: string;
  price: number;                 // lprice
  relation: Relation;
  reason: string;                // 한국어 20자 이내
  spec: { perItemAmount: number | null; perItemUnit: Unit | null; itemCount: number | null; hasGift: boolean };
  evidence: { brand: boolean; line: boolean; variant: 'yes' | 'no' | 'unclear'; amount: boolean; count: boolean };
  verifiedLink: boolean;
  reported: boolean;
}
```

### `POST /api/read-tag`
- 요청: `{ scanId, imageBase64, barcodeFromImage?, mode: 'normal'|'test'|'demo', participantCode?, storeName? }`
- 응답 200: `{ ocr: TagReading, ms, costKrw }` / 422: `{ error: 'unreadable' }`
- 처리: 토큰 검증 → 제한 확인 → 모델 호출(7장) → zod 검증 → 단위 재정규화 → `scans` upsert → `api_calls` 기록 → test 모드면 사진을 `test-photos/<scanId>.jpg`에 저장.

### `POST /api/compare`
- 요청: `{ scanId, target: TargetSpec, storePrice: number | null, productId?, barcode?, prefetch: boolean }`
- 응답 200:
```ts
{
  fetchedAt: string;             // ISO. 캐시 응답이면 원래 조회 시각
  queries: string[];
  scope: { source: 'naver'; nFetched: number; nOther: number };
  candidates: Candidate[];
  degraded: boolean;             // LLM 실패로 문자열 규칙만 쓴 경우
  costKrw: number;
}
```
- 처리: 8장. 끝나면 `scans`에 n_* 요약과 서버 계산 판정(행사 미적용 기준)을 기록.

### `GET /api/stats` (헤더 `x-admin-passcode`) — 10장의 지표 + `?export=<table>` CSV
### `POST /api/admin/products` (패스코드) — CSV 업로드·수정
### `POST /api/admin/links` (패스코드) — 연결 정보 저장·상태 변경
### `GET /api/health` — `{ ok: true, version }`

---

## 7. 가격표 읽기 — `/api/read-tag`

### 7.1 도구 스키마 (강제 호출: `tool_choice: { type: 'tool', name: 'record_tag' }`)
```json
{
  "name": "record_tag",
  "description": "Record what is printed on the photographed Korean supermarket price tag or package.",
  "input_schema": {
    "type": "object",
    "properties": {
      "image_kind": { "type": "string", "enum": ["shelf_tag", "product_package", "receipt", "other"] },
      "product_name_raw": { "type": ["string", "null"] },
      "brand": { "type": ["string", "null"] },
      "product_name": { "type": ["string", "null"] },
      "variant": { "type": ["string", "null"] },
      "per_item_amount": { "type": ["number", "null"] },
      "per_item_unit": { "type": ["string", "null"], "enum": ["ml", "g", "m", "sheet", "ea", null] },
      "item_count": { "type": ["integer", "null"] },
      "store_price": { "type": ["integer", "null"] },
      "regular_price": { "type": ["integer", "null"] },
      "promo": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["none", "n_plus_m", "percent_off", "card_discount", "multi_buy", "other"] },
          "text": { "type": ["string", "null"] },
          "n": { "type": ["integer", "null"] },
          "m": { "type": ["integer", "null"] }
        },
        "required": ["type", "text"]
      },
      "tag_unit_price": {
        "type": ["object", "null"],
        "properties": {
          "price": { "type": "number" },
          "per_amount": { "type": "number" },
          "per_unit": { "type": "string", "enum": ["ml", "g", "m", "sheet", "ea"] }
        }
      },
      "barcode_digits": { "type": ["string", "null"] },
      "multiple_tags_visible": { "type": "boolean" },
      "confidence": {
        "type": "object",
        "properties": {
          "product": { "type": "number" },
          "size": { "type": "number" },
          "price": { "type": "number" }
        },
        "required": ["product", "size", "price"]
      },
      "notes": { "type": ["string", "null"] }
    },
    "required": ["image_kind", "product_name_raw", "brand", "product_name", "variant", "per_item_amount",
                 "per_item_unit", "item_count", "store_price", "regular_price", "promo", "tag_unit_price",
                 "barcode_digits", "multiple_tags_visible", "confidence", "notes"]
  }
}
```
SDK에 structured outputs가 정식으로 있으면 그걸 써도 되지만, 강제 tool 호출이 기본값이다.

### 7.2 시스템 프롬프트 (`server/prompts/readTag.ts`)
```
You read photos that shoppers take in Korean supermarkets. The photo usually shows a shelf price tag (가격표); sometimes it shows a product package.

Record only what is printed and legible. Never guess or fill in from your own knowledge of products. If a value is not clearly legible, use null and lower the matching confidence.

How to read each field:
- product_name_raw: the product name line exactly as printed (keep Korean abbreviations and spacing).
- brand: the brand or maker as printed (e.g., "다우니", "농심"). If no brand is printed and it is not part of the printed name, use null.
- product_name: the name without brand, size or count (e.g., "섬유유연제 실내건조").
- variant: scent / flavor / type words if printed (e.g., "실내건조", "매운맛", "라벤더"); otherwise null.
- per_item_amount + per_item_unit: the size of ONE item. Units: "ml" (convert L ×1000), "g" (convert kg ×1000), "m" (toilet-paper roll length per roll), "sheet" (wet-wipe sheets per pack), "ea" (only for items sold by count with no size printed, e.g., coffee-mix sticks "180T").
- item_count: how many items the shown store price buys. "30롤" → 30, "5입" → 5, a single bottle → 1. Multiply nested packs: "120g×5입×4" → 20. "1박스" alone does not change the count.
- store_price: the price the shopper pays now, in KRW as an integer. If a sale price (행사가/할인가) and a regular price are both printed, store_price is the sale price.
- regular_price: the regular (정상가) or crossed-out price if printed; otherwise null.
- promo: report promotions as printed. "1+1" → type "n_plus_m", n=1, m=1. "2+1" → n=2, m=1. Card discounts → "card_discount". Do NOT change store_price because of a promotion.
- tag_unit_price: the unit price printed on the tag (단위가격, e.g., "100ml당 384원") → {price: 384, per_amount: 100, per_unit: "ml"}. Convert L/kg to ml/g. Null if not printed.
- barcode_digits: the digits printed under a barcode if legible (8 or 13 digits); otherwise null.
- multiple_tags_visible: true if more than one price tag is visible. Then read the tag closest to the center and largest.
- confidence: 0–1 for product (brand + name + variant), size (amount + unit + count) and price.
- notes: a short Korean note when something is ambiguous (e.g., "가격 일부 가려짐"); otherwise null.

Always respond by calling the record_tag tool.
```

### 7.3 후처리
- zod 검증 실패 → 검증 오류 메시지를 붙여 1회 재시도 → 그래도 실패하면 422.
- 서버에서 단위 재정규화(`shared/units.ts`) 후 파생값 계산: 총용량, 매장 단위가격, 가격표 단위가격 교차검증 `{ ok, diffPct }`.
- `image_kind`가 receipt/other이거나 (store_price와 product_name이 둘 다 null) → 422 unreadable.
- 타임아웃 15초, 이미지 4MB 초과 거절.

### 7.4 정확도 평가 — `scripts/eval-tags.ts`
- `fixtures/tags/NNN.jpg` + 정답 `NNN.json`(같은 스키마)을 전부 돌려 필드별 정확도 표를 `fixtures/tags/_report.md`로 출력.
  - 매장가: 정확히 일치 / 브랜드: 정규화 후 일치 / 개당 용량: 1% 이내 + 단위 일치 / 수량: 일치 / 행사 유형: 일치 / 종류: 참고용.
- 모델 비교: `MODEL_TAG=claude-haiku-4-5-20251001 npm run eval:tags`처럼 env만 바꿔 같은 표를 만든다.
- 정답 JSON 작성 [H]: Claude Code가 모델 결과로 초안을 만들어 줄 수 있지만, 기령이 **사진을 보며 칸마다** 확인해서 고친다. 초안을 훑어보고 승인만 하면 평가가 의미 없어진다.

---

## 8. 온라인 조회와 '같은 상품' 분류 — `/api/compare`

### 8.1 검색어
- 큐레이션 상품이면 `products.search_query`.
- 아니면 q1 = `{brand} {productName} {variant} {용량표기}`. 용량표기: ml·g는 "2.6L" "500ml" "1kg" "120g"(1000 이상이면 L·kg, 소수 1자리), m는 "30m 30롤", sheet는 "100매", ea는 생략.
- q1에서 브랜드가 맞는 결과가 5개 미만이면 q2 = 용량표기를 뺀 검색어를 한 번 더.
- 각 호출 `display=40&sort=sim&exclude=used:rental:cbshop`. productId 기준 중복 제거 후 원래 순위로 상위 25개.

### 8.2 네이버 호출과 정리 (`server/naver.ts`)
- `GET https://openapi.naver.com/v1/search/shop.json`, 헤더 `X-Naver-Client-Id`, `X-Naver-Client-Secret`. 타임아웃 5초, 5xx·타임아웃 1회 재시도.
- 응답 필드: title(`<b>` 태그 포함), link, image, lprice(문자열), hprice, mallName, productId, productType, brand, maker, category1~4. **배송비 필드는 없다.**
- 정리: 태그 제거, HTML 엔티티 복원, lprice → number, 0 이하 제거.
- productType '1'~'3'(일반 상품)만 사용, 나머지(중고·단종·판매예정)는 버린다 — 이 값의 의미는 네이버 개발자센터 문서로 한 번 더 확인할 것.
- `isCatalog = productType === '1'` → 판매처 표기는 "네이버 가격비교(여러 판매처)".
- 메모리 캐시: 키 = 정규화한 검색어, TTL 10분. 캐시 응답도 원래 `fetchedAt`을 그대로 보낸다(P6).
- `api_calls`에 endpoint='naver', ms, ok.

### 8.3 규격 파서 — `shared/spec/parseSpec.ts`
```ts
export interface ParsedSpec {
  perItemAmount: number | null;
  perItemUnit: Unit | null;
  itemCount: number | null;
  hasGift: boolean;
  isMixed: boolean;
  confidence: 'high' | 'low';
  tokens: string[];   // 해석에 쓴 토큰 (근거 표시·디버깅용)
}
export function parseSpec(title: string): ParsedSpec;
```
구현 가이드 — **정답은 부록 A 테스트**다. 실제 검색 결과에서 틀린 걸 볼 때마다 부록 A에 케이스를 추가한다.
1. 정규화: NFKC(㎖·ℓ·㎏ 등), `×` `＊` `*` 대문자 `X` → `x`, 소문자화, 공백 정리. 대괄호 머리말(`[본사직영]` `[무료배송]` 등)은 숫자 해석에서 뺀다.
2. 증정 분리: "+ 증정 …", "증정", "사은품", "덤" 뒤 구간은 숫자 해석에서 빼고 `hasGift=true`.
3. 혼합: "택1", "골라담기", "옵션", "선택", 또는 같은 계열(ml·l / g·kg)의 서로 다른 개당 용량이 2개 이상(괄호 속 총량 표기는 제외) → `isMixed=true`.
4. 용량 토큰: 숫자 + ml / l / 리터 / g / kg / 그램 / m / 매. `cm`·`mm`는 용량이 아니다("페리오 46cm"). `m`는 같은 제목에 '롤'이 있을 때만 롤당 길이. `매`는 다른 개수 토큰(팩 등)과 함께면 팩당 매수, 혼자면 그 자체가 개당 용량.
5. 개수 토큰: 숫자 + 개 / 개입 / 입 / 팩 / 봉 / 봉지 / 캔 / 병 / 롤 / 구 / 포 / t / ea / p / 세트 / 박스 / 통 / 개묶음, 그리고 `x N` · `N x`. `N+M`은 양쪽이 단위 없는 정수일 때만 행사 표기다(1+1 → 2, 3+1 → 4). `+` 뒤에 용량이 이어지면("210g 12개 + 210g 12개") 묶음 연결이다 — 같은 용량이면 개수를 더하고, 다른 용량이면 혼합(isMixed).
6. 바깥 개수끼리 곱한다("30롤 x 2팩" → 60, "(120g x 5) x 4" → 20). "1박스" "1세트"는 ×1.
7. 괄호는 세 가지로 나눠 읽는다. ① 괄호 바로 뒤에 `x N`이 오면 묶음 괄호 — 안을 펼쳐 바깥과 곱한다("(120g x 5) x 4"). ② 첫 용량 표기보다 앞에 있는 괄호는 일반 토큰("(10개묶음) 신라면 120g"). ③ 그 밖의 괄호는 총량 재표기("(총 24개)" "(40개)" "(6병x2팩)" "(총 6.2L)" "(총 1000매)") — 계산값과 같으면 확인용으로만 쓰고 곱하지 않는다. 바깥에 개수 표기가 없으면 괄호 값을 쓴다. 서로 다르면 `confidence='low'`.
   - 이 10개 규칙만으로 부록 A 40개가 전부 통과하는 것을 `reference/parser_prototype.py`로 확인했다(규칙끼리 모순 없음). 참고 구현일 뿐이니 그대로 옮기지 말고 TS로 깔끔하게 새로 쓴다 — 기준은 테스트다.
8. 용량은 있는데 개수 토큰이 없으면 `itemCount=1`.
9. 용량 표기가 없으면 `perItemAmount=null`(개수는 있으면 채움). 이것만으로 confidence를 낮추지 않는다 — 용량이 꼭 필요한 상품인지는 합의 규칙(8.5의 4번)이 target 단위를 보고 판단한다(커피믹스 180T 같은 ea 상품은 용량 없이도 비교 가능).
10. 해석이 하나로 정해지지 않으면 `confidence='low'`.

### 8.4 LLM 분류 보조 — `server/classify.ts`
- 입력: target + 후보(id, title, brand, maker). 후보를 10개씩 나눠 **병렬 호출**해서 지연을 줄인다. 호출당 타임아웃 6초.
- 강제 tool `classify_listings` → `items[{ id, same_line, variant_match: 'yes'|'no'|'unclear', per_item_amount, per_item_unit, item_count, is_mixed, has_gift, reason }]`. 출력 토큰을 줄이려고 reason은 20자 이내.
- 시스템 프롬프트 (`server/prompts/classify.ts`):
```
You check whether online shopping listings (titles from Naver Shopping) are the same product as a target product photographed in a Korean supermarket.

For each listing decide:
- same_line: true only if it is the same brand AND the same product line as the target (not just another product from the same brand).
- variant_match: "yes" if the scent / flavor / type is the same as the target's; "no" if it is clearly different; "unclear" if the title does not say. If the target has no variant, answer "yes" unless the listing clearly names a specific different variant.
- per_item_amount, per_item_unit, item_count: read from the title only. Normalize L→ml and kg→g. If a single size is printed and no count, item_count = 1. Use null when a value is not printed. Never use your knowledge of typical package sizes.
- is_mixed: true if the listing offers several sizes or options (택1, 골라담기, 옵션, several sizes in one title).
- has_gift: true if a free gift (증정, 사은품) is included.
- reason: at most 20 Korean characters naming the deciding fact (e.g., "용량 다름 1.6L", "향 다름 라벤더", "옵션 상품").

Be conservative: when unsure, use "unclear" or null. Always respond by calling the classify_listings tool.
```

### 8.5 합의 규칙 — `shared/match/combine.ts`
후보마다 위에서부터 처음 맞는 규칙을 적용한다. **두 검사(파서와 LLM)가 동의할 때만 SAME_ITEM**이다.
1. 브랜드: LLM `same_line=false` → OTHER. LLM이 true라도 제목·brand·maker 어디에도 target.brand(공백 제거·소문자, `shared/units.ts`의 별칭표 포함)가 없으면 UNCERTAIN("브랜드 확인 필요").
2. 혼합: 파서 `isMixed` 또는 LLM `is_mixed` → UNCERTAIN("옵션·혼합 상품").
3. 종류: LLM `variant_match='no'` → OTHER / `'unclear'` → UNCERTAIN("종류 확인 필요").
4. 개당 용량
   - target 단위가 ea가 아닌데 파서·LLM 둘 다 null → UNCERTAIN("용량 표기 없음").
   - 둘 다 값이 있는데 1% 넘게 다름 → UNCERTAIN("판독 불일치").
   - 값(파서 우선)이 target과 1% 이내면 '용량 같음', 아니면 SIZE_DIFF.
5. 수량: 둘 다 값이 있는데 다름 → UNCERTAIN("수량 판독 불일치"). 둘 다 null → UNCERTAIN("수량 표기 없음"). 파서 `confidence='low'`이고 LLM 값도 없으면 UNCERTAIN.
6. 남은 '용량 같음' → SAME_ITEM. 수량이 target과 같은지는 판정 단계에서 본다(행사 토글로 target 수량이 바뀔 수 있어서).
7. LLM 실패(타임아웃·오류): 1·3번을 문자열 규칙으로 대신한다 — target.variant가 있으면 제목(공백 제거)에 그 문자열이 있어야 하고, 없으면 UNCERTAIN("종류 확인 필요"). 응답에 `degraded=true`, 판정 화면에 "일부 확인을 건너뛰었어요"를 표시.
8. 연결 정보 덮어쓰기(큐레이션 상품일 때): `relation='same_item'` & `status='verified'` → SAME_ITEM + `verifiedLink`(수량은 이번 제목의 파싱값) / `relation='wrong'` → OTHER / `status='reported'` → UNCERTAIN("신고된 연결").
9. OTHER는 응답에서 빼고 `scope.nOther`에 개수만 센다.

### 8.6 사용자 피드백 → 연결 정보
- "같은 상품 맞아요"(큐레이션 상품일 때만) → `product_links` upsert(status='user_confirmed', confirmations+1). 3회 이상이면 관리자 화면 맨 위에 '확인 후보'로 올린다. 자동으로 verified로 올리지는 않는다.
- "아니에요"·신고 → `reports` + 해당 링크 status='reported'.

---

## 9. 판정 — `shared/verdict/verdict.ts` (클라이언트·서버 공용)

```ts
export type VerdictType =
  | 'NEED_STORE_PRICE'  // 매장가 없음 → 입력 요청
  | 'STORE_CHEAPER'
  | 'SAME_PRICE'
  | 'ONLINE_CHEAPER'
  | 'BUNDLE_ONLY'       // 같은 수량은 없고 묶음·다른 용량만 있음
  | 'NO_MATCH';

export interface Verdict {
  type: VerdictType;
  diff?: number;               // STORE_CHEAPER: 마트가 싼 금액 / ONLINE_CHEAPER: 온라인이 싼 금액
  breakEvenShipping?: number;  // ONLINE_CHEAPER일 때 = diff
  closeCall?: boolean;         // ONLINE_CHEAPER이고 diff < CLOSE_CALL_KRW
  bestExact?: Candidate;
  unitWinner?: 'store' | 'online';                 // BUNDLE_ONLY일 때
  bundleInsight?: { candidate: Candidate; pct: number; count: number; total: number };
  store: { price: number; count: number; unitPrice: number; unitLabel: string };
}

export function decide(input: {
  target: TargetSpec;
  storePrice: number | null;
  promo: Promo | null;
  promoApplied: boolean;
  candidates: Candidate[];
}): Verdict;

export const CLOSE_CALL_KRW = 3000;
export const BUNDLE_MARGIN = 0.03;
export const UNIT_BASE = { ml: 100, g: 100, m: 10, sheet: 100, ea: 1 } as const;
// 표시: "100ml당" "100g당" "10m당" "100매당" "1개당"
```
1. storePrice가 없으면 NEED_STORE_PRICE.
2. 매장 기준값: 행사 미적용 → (price = storePrice, count = target.itemCount). n+m 행사 적용 → (price = storePrice × n, count = target.itemCount × (n + m)). 예: 1+1 → 가격 그대로, 개수 2배 / 2+1 → 가격 2배, 개수 3배.
3. 단위가격 = price ÷ (개당 용량 × 개수) × UNIT_BASE[단위]. 단위가 ea면 price ÷ 개수.
4. exacts = SAME_ITEM 중 itemCount가 매장 count와 같은 것. bestExact = 그중 가장 싼 것.
5. bestExact가 있으면 diff = 매장 price − bestExact.price
   - diff < 0 → STORE_CHEAPER (diff = |diff|)
   - diff = 0 → SAME_PRICE
   - diff > 0 → ONLINE_CHEAPER (breakEvenShipping = diff, closeCall = diff < 3000)
6. 묶음 후보 = (SAME_ITEM 중 수량이 다른 것) ∪ SIZE_DIFF — 용량·수량이 모두 있는 것만. bestBundle = 단위가격이 가장 낮은 것. bestBundle 단위가격 < 매장 단위가격 × (1 − 0.03)이면 bundleInsight = { pct: round((1 − 묶음/매장) × 100), count, total: 그 상품 가격 }.
7. bestExact가 없을 때: 묶음 후보가 있으면 BUNDLE_ONLY, 없으면 NO_MATCH. BUNDLE_ONLY의 unitWinner는 bestBundle 단위가격 < 매장 단위가격 × (1 − 0.03)일 때만 'online', 그 외(마트가 싸거나 3% 안쪽으로 비슷)는 'store'.
8. UNCERTAIN은 어떤 계산에도 들어가지 않는다.
9. 표시 반올림: 금액은 정수 원. 단위가격은 10 이상이면 정수, 10 미만이면 소수 1자리.

테스트 케이스는 부록 D.

---

## 10. 측정

### 10.1 이벤트 (`src/lib/events.ts` → `events` 직접 insert, 모든 props에 `mode` 포함)
| name | props |
|---|---|
| app_open | standalone, lang |
| capture_start | source: photo / barcode_live / manual / demo |
| tag_read | ms, ok, imageKind, confidence, barcodeFound |
| confirm | msSinceCapture, editedFields[], curatedMatch |
| result_shown | msSinceCapture, verdict, nSame, nSize, nUncertain, diff, closeCall, degraded |
| promo_toggle | on |
| evidence_open | — |
| outbound_click | externalId, mallName, relation, isCatalog |
| link_feedback | externalId, value: same / not_same |
| decision | channel: store / online / none |
| purchase_confirmed | from: planned |
| report_wrong | kind |
| demo_run | scenario, live |
| survey | q, answer |
| install | — |
| lang_toggle | to |

### 10.2 `/stats` 지표 (기간·mode 필터, demo는 기본 제외)
- 스캔 수, 사용자 수, 날짜별 스캔.
- **셔터→판정 시간**: result_shown.msSinceCapture 중앙값·p90.
- **인식 수정률**: confirm.editedFields의 필드별(가격·브랜드·용량·수량) 비율. 현장에서 본 OCR 정확도.
- **같은 상품 발견율**: nSame ≥ 1인 비율 + 판정이 STORE_CHEAPER/SAME_PRICE/ONLINE_CHEAPER인 비율(같은 수량까지 찾은 비율).
- **판정 분포**: 6개 유형별 건수. "마트에서 사세요"라고 말한 횟수(STORE_CHEAPER + SAME_PRICE)를 따로 크게.
- **신고율**: report_wrong ÷ result_shown, 링크 피드백 not_same 비율.
- **잠재 절약액**: ONLINE_CHEAPER diff 합계. "배송비 미반영 추정"이라는 말을 붙여서.
- **구매 확인**: 마트 confirmed / 온라인 planned / planned→confirmed 전환.
- **재사용**: 서로 다른 2일 이상 스캔한 사용자 비율.
- **비용**: 스캔당 평균 cost_krw(api_calls를 scan_id로 합산), 누적 비용.
- **현장 실험**(manual_trials): 같은 상품 쌍의 직접 검색 시간 vs 앱 시간(중앙값), 직접 검색 성공률(found_same) vs 앱의 같은 상품 발견율, 직접 검색에 쓴 앱 분포(쿠팡 비중 = 지금 조회 범위 밖의 비율), 신뢰 선택 분포.
- 모든 표 CSV 내보내기.

---

## 11. 현장 테스트 모드 — `/test`
목적: 지원서 3단계 '현장 검증'의 첫 데이터. 같은 상품으로 직접 검색과 앱의 시간·정확도를 비교한다.
- 시작: 참가 코드(H01, H02 …) + 동의 체크 두 개 — "가격표 사진이 저장되는 것에 동의해요", "(미성년 참가자) 보호자가 동의했어요".
- 상품 목록: 진행자가 그 자리에서 이름을 적어 추가(최대 10개).
- 순서: 홀수 번째 상품은 직접 검색 먼저, 짝수 번째는 앱 먼저(학습 효과 상쇄).
  - 직접 검색: [시작] → 참가자가 평소 쓰는 쇼핑 앱으로 같은 상품을 찾는다 → [같은 상품 찾음] [애매함] [포기] → 찾은 가격(선택), 쓴 앱(쿠팡 / 네이버 / 마트 앱 / 기타).
  - 앱: 일반 촬영 흐름을 test 모드로 실행(가격표 사진 저장, scan_id를 trial에 연결).
  - 상품이 끝나면 한 번 탭: "어느 쪽 결과를 더 믿어요?" (직접 검색 / 앱 / 같아요)
- 마지막 3문항 → events(name='survey'): 가장 헷갈렸던 화면(자유) / 다음 장보기에도 쓸지(1~5) / 가장 확인하고 싶은 품목(자유).
- 화면 위 진행자 안내문: 가격표만 찍고 사람이나 진열 전체는 찍지 않기. 통로를 막지 않기. 직원이 물으면 학생 창업 프로젝트 테스트라고 설명하고 요청에 따르기.

---

## 12. 데모 모드 — `/demo`
목적: 매대가 없는 곳(인터뷰장, 멘토링, 심사)에서 30초 안에 핵심을 보여 주기.
- 시나리오 3종 — 오늘 마트에서 찍은 실제 가격표 중에서 고른다.
  - D1 마트가 이기는 판(STORE_CHEAPER)
  - D2 온라인이 이기지만 배송비가 변수인 판(ONLINE_CHEAPER + closeCall)
  - D3 묶음 함정(bundleInsight 또는 BUNDLE_ONLY — 예: 휴지 30롤 vs 60롤)
- 기본은 실시간(실제 사진으로 read-tag → compare). 네트워크 실패·6초 초과·오프라인이면 `fixtures/demo/D*.json` 녹화 응답으로 재생하고 상단에 "녹화된 데모 결과예요({녹화 시각} 기준). 실시간 가격이 아니에요."를 표시(P1).
- 데모는 구매 기록·지표에 섞이지 않는다(mode='demo').
- 언어 토글(ko/en)이 데모 전체에 적용된다. 상품명은 원문(한국어) 그대로.
- `scripts/record-demo.ts`: 사진 3장으로 실제 호출 → 응답과 녹화 시각을 `fixtures/demo/D1.json …`에 저장.
- 오프라인 재생이 되려면 데모 사진·녹화 JSON이 PWA 캐시에 들어가 있어야 한다(precache).

---

## 13. 디자인 방향 — "가격표와 영수증의 언어"

앱은 마트의 시각 언어로 말한다. 찍는 버튼은 가격표처럼 생겼고, 결과는 항목별로 근거를 적은 영수증이다. "무엇과 무엇을 어떤 조건으로 비교했는지 보여 준다"는 지원서 문장을 화면 형식 자체로 만든 것이다.

### 토큰 (지원서 영상·이미지에서 쓴 팔레트를 그대로 이어 간다)
| 이름 | 값 | 쓰임 |
|---|---|---|
| Paper | `#F5EFE0` | 배경 |
| Ink | `#000000` | 본문·숫자 (근사 검정이 아니라 검정 그대로) |
| Receipt | `#FFFFFF` | 영수증 카드 한 장 |
| Lime | `#C6F542` | 더 싼 쪽 줄 뒤의 형광펜 띠. 항상 검정 글자와 함께 |
| Pink | `#FF6FA5` | '확인 필요'·주의 배지 채움. 분홍색 글자는 쓰지 않는다(대비 부족) |
| Muted | `#6B6457` | 보조 텍스트 (Paper 위 대비 약 5:1) |

- 글꼴: Pretendard Variable 하나. 굵기 400 / 600 / 800. 크기(px): 13 / 15 / 17 / 22 / 30 / 56. 모든 가격은 `font-variant-numeric: tabular-nums`, 영수증 안에서 오른쪽 정렬.
- 판정 금액은 56px / 800. 형광등 아래 매대 앞에서 팔 길이 거리로 읽혀야 하므로 큰 숫자가 실제로 가장 맞는 선택이다. 그라데이션·장식은 없다.

### 레이아웃
- 한 열, 최대 폭 480px, 글은 왼쪽 정렬. 주요 동작은 엄지가 닿는 아래쪽. 결과 화면은 아래 고정 행동 바. 터치 영역 48px 이상.
- 기억에 남을 단 하나: **비교 영수증** 카드 — 위아래 지그재그 절취선(CSS mask), 점선 구분선, 이긴 줄 뒤의 라임 형광펜 띠. 그림자는 이 카드 한 장에만 종이처럼 옅게. 나머지 화면은 조용하게.
- 홈의 [가격표 찍기]는 큰 가격표 모양(왼쪽에 펀치 구멍, 모서리 하나를 비스듬히 자른 사각형).

```
┌────────────────────────────────┐
│ 다우니 실내건조 2.6L 1개        │
│                                │
│ 온라인이 1,080원 싸요           │  30px / 800
│ 배송비가 1,080원보다 적을 때만   │
│ 이에요.                         │
│ [차이가 작아서 배송비에 따라     │  Pink 배지
│  뒤집힐 수 있어요]              │
│╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱│
│ 비교 영수증                     │
│ 매장   이마트           9,980원 │
│        100ml당 384원            │
│ 온라인 네이버 가격비교   8,900원 │  ← Lime 띠
│        100ml당 342원            │
│        배송비 미확인             │
│ - - - - - - - - - - - - - - - - │
│ 차액                   1,080원  │
│ 손익분기 배송비          1,080원  │
│ - - - - - - - - - - - - - - - - │
│ 같은 상품으로 본 이유  ▾         │
│ 14:32에 네이버 쇼핑 검색 결과     │
│ 40개를 확인했어요. 쿠팡 가격은    │
│ 아직 포함되지 않아요.            │
│╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲│
│ 묶음·다른 용량 (단위가격으로 비교) │
│ 확인 필요 (추천하지 않아요)       │
├────────────────────────────────┤
│ [마트에서 살게요][온라인으로][안 살래요] │
└────────────────────────────────┘
```

### 움직임·접근성·피할 것
- 움직임은 한 번: 결과가 도착하면 영수증이 위에서 "인쇄되듯" 내려온다(약 280ms). `prefers-reduced-motion`이면 바로 표시. 그 외에는 사용자 동작에 대한 상태 변화만.
- 색만으로 뜻을 전하지 않는다: 이긴 줄은 라임 띠 + "더 싸요" 글자, 확인 필요는 분홍 배지 + 글자.
- 피할 것: 모든 내용을 똑같은 둥근 카드로 쪼개기, 대문자 라벨, 가운뎃점으로 이은 메타 문자열, 버튼 글자 뒤 화살표, 장식용 그라데이션.
- 문구는 짧고 능동형, 숫자가 먼저. 오류는 사과하지 않고 무슨 일이 있었고 무엇을 하면 되는지 말한다. 모든 문구는 `src/copy/`에만 둔다(부록 C).

---

## 14. 작업 순서와 수용 기준

모든 Phase 끝에: 테스트 → 프리뷰 배포(버전 +0.001, CHANGELOG·updateLogs) → PROGRESS.md 갱신(한 일, 수치, 남은 일) → Verifier 점검(수용 기준 수치 + 원칙 P1~P7 위반 여부).

### Phase 0 — 셋업과 첫 배포 (약 1시간)
- [H] **H0-1 계정·키**
  - 네이버 개발자센터 → Application → 애플리케이션 등록: 사용 API '검색', 환경 'WEB'에 배포 주소 → Client ID / Client Secret.
  - Anthropic Console(부모님 계정): 이 앱 전용 워크스페이스와 API 키, 월 사용 한도를 낮게(예: $20).
  - Supabase: 새 프로젝트 `kkr-jinjja`(리전 서울), Authentication에서 Anonymous sign-ins 켜기, Storage에 비공개 버킷 `test-photos`, URL·anon key·service_role key.
  - GitHub 저장소 `kkr_jinjja` → Vercel에서 import.
- [H] **H0-2 마트 사진**(20분, 가능하면 매장 두 곳): 가격표 25~30장 — 세탁·주방·욕실·종이·가공식품·음료 골고루, 행사 가격표 5장 이상, 반사되거나 기울어진 사진도 몇 장. `fixtures/tags/001.jpg …`. 데모로 쓸 만한 것은 따로 표시.
- [H] **H0-3 상품 30개 목록**(부록 B) — 집에 있는 실제 제품을 보고, 바코드 숫자까지.
- [C] C0-1 Vite + React + TS + Tailwind + Router + Vitest + ESLint/Prettier, 4장 폴더 구조, `version.ts`(0.001)·`updateLogs.ts`·`CHANGELOG.md`·버전 배지.
- [C] C0-2 `vercel.json`(icn1, maxDuration 30), env 연결, `/api/health`(shared/ 함수 하나 import) 배포 → 폰에서 확인.
- [C] C0-3 마이그레이션 0001 적용, 첫 방문 시 `signInAnonymously`.
- **수용 기준**: 폰에서 HTTPS 주소가 열리고 하단에 v0.001 / `/api/health` OK / 익명 user id 생성 / api/ → shared/ import가 배포 환경에서 동작.

### Phase 1 — 가격표 읽기 (1.5~2시간)
- [C] C1-1 촬영 + 압축 + EXIF (`src/lib/image.ts`)
- [C] C1-2 사진 속 바코드 디코딩 (`src/lib/barcode.ts`)
- [C] C1-3 `/api/read-tag`(7장) + api_calls + 사용자당 제한
- [C] C1-4 확인 카드 S2: 필수 필드, 저신뢰 표시, 단위가격 교차검증, 큐레이션 칩, 매장 칩, corrections
- [C] C1-5 `scripts/eval-tags.ts` → `_report.md` → 표를 PROGRESS.md에
- [H] **H1-1 정답 JSON 30개**(7.4)
- **수용 기준**: 평가셋에서 매장가 ≥ 95%, 브랜드 ≥ 85%, 용량+수량 ≥ 85%. 못 미치면 프롬프트를 고쳐 다시 평가하고 시도마다 수치를 PROGRESS.md에 남긴다. LTE에서 셔터→확인 카드 중앙값 ≤ 6초.

### Phase 2 — 온라인 조회와 매칭 (2~3시간, 가장 중요)
- [C] C2-1 `parseSpec` + 부록 A 테스트(테스트 먼저 쓰고 통과시키기)
- [C] C2-2 `server/naver.ts`(8.1~8.2, 캐시)
- [C] C2-3 `server/classify.ts` + `shared/match/combine.ts` + 테스트(가짜 LLM 응답으로)
- [C] C2-4 `/api/compare`(8.5~8.6, scans 요약)
- [C] C2-5 선조회: OCR 직후, 그리고 바코드가 큐레이션 상품과 맞으면 OCR보다 먼저
- [C] C2-6 `scripts/eval-match.ts`: 30개 상품을 돌려 상품별 SAME_ITEM / SIZE_DIFF / UNCERTAIN 제목을 표로 출력
- [H] **H2-1** eval-match 표에서 잘못 분류된 것 표시 → 부록 A·combine 테스트에 케이스 추가
- **수용 기준**: 파서·합의 테스트 100% / 30개 중 SAME_ITEM을 1개 이상 찾는 비율 ≥ 70% / 기령 검수에서 **잘못된 SAME_ITEM 0건** / [맞아요, 비교하기]→결과 표시 중앙값 ≤ 3초(선조회 포함).

### Phase 3 — 판정 화면 (1.5시간)
- [C] C3-1 `decide()` + 부록 D 테스트
- [C] C3-2 결과 화면 S3(비교 영수증, 근거, 아래 두 칸, 조회 문장, 출처, 수수료 문구, 지난번 가격)
- [C] C3-3 행사 토글
- [C] C3-4 행동 버튼(구매 확인·예정, 다음 예정일), 결과 신고, 링크 피드백
- [H] **H3-1 판정 문구 ko/en 최종본** — 부록 C 초안을 기령이 고쳐 `src/copy/`에 반영
- **수용 기준**: 판정 테스트 통과 / 6개 판정 유형을 390px 폭에서 하나씩 확인(스크린샷을 PROGRESS.md에) / 색만으로 뜻을 전하는 곳 0.

### Phase 4 — 기록과 측정 (1.5시간)
- [C] C4-1 이벤트 유틸 + 10.1 연결
- [C] C4-2 기록 화면 S4
- [C] C4-3 `/stats` + CSV
- [C] C4-4 `/test`(11장)
- **수용 기준**: 폰에서 스캔→구매 확인 1회 후 /stats에 반영 / /test로 상품 1개 실험이 기록됨.

### Phase 5 — 큐레이션·데모·설치·영어 (1.5~2시간)
- [C] C5-1 `/admin`(CSV 업로드, 연결 확인, 신고 목록) — 시간이 없으면 `scripts/import-products.ts`로 대신
- [C] C5-2 `/demo` + `scripts/record-demo.ts` + precache
- [C] C5-3 PWA: manifest, 아이콘(가격표 모양 + 물음표 SVG에서 생성), iOS 설치 안내
- [C] C5-4 ko/en 토글
- [H] **H5-1 상품 30개 등록 + 연결 확인**(기령·팀원이 나눠서)
- **수용 기준**: 홈 화면에 설치해서 실행 / 비행기 모드에서 /demo 3종 재생 / 영어 모드에서 데모 전 과정이 영어.

### Phase 6 — 현장 테스트 (저녁, 1시간)
- [H] 가족과 마트에서 /test 모드로 상품 10개.
- [C] 결과 요약(셔터→판정 시간, 수정률, 발견율, 실패 사례)을 PROGRESS.md에 쓰고 고칠 것 목록을 다음 작업으로.
- **수용 기준**: 실제 매장 스캔 ≥ 10건, manual_trials ≥ 5쌍이 /stats에 있음.

### 시간이 모자랄 때 자르는 순서
S1b 라이브 바코드 → C5-1 관리자 화면(스크립트로 대신) → C5-4 영어(10/10까지) → C4-4 실험 모드(폰 스톱워치 + 메모로 대신) → C3-3 행사 토글(행사 문구만 표시).
**자르지 않는 것**: 원칙 P1~P7, Phase 1~3, 데모.

---

## 15. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 반사·기울기로 가격표 오독 | 촬영 안내, 신뢰도 표시, 확인 카드, 단위가격 교차검증 |
| 네이버 결과의 잡음(옵션·묶음·다른 향) | 두 검사 합의, 보수적 분류, 큐레이션 연결 |
| 쿠팡 미포함 | 조회 문장에 명시. 실험 모드에서 직접 검색 때 쿠팡을 쓴 비중을 재서 다음 데이터 경로를 정하는 근거로 |
| 매장 통신이 약함(지하층) | 이미지 압축, 재시도 1회, 직접 입력 경로, 데모 녹화 재생 |
| 마트마다 가격표 형식이 다름 | 평가셋을 두 매장 이상에서 모으고 매장별 정확도를 따로 본다 |
| 매장 내 촬영 제지 | 가격표만, 짧게, 직원 요청에 따름 |
| API 키 남용(링크 유출) | 키는 서버에만, 사용자당 시간당 60회, Anthropic 월 한도 |
| 비용 | api_calls 실측, 모델은 env로 교체 |
| Vercel Hobby는 비상업용 | 상업화 단계에서 Pro로 전환 |
| Supabase 무료 프로젝트는 오래 안 쓰면 일시정지 | 테스트 기간엔 꾸준히 사용, 정식 운영 전 유료 전환 검토 |
| 개인정보·미성년 참가자 | 익명 ID, 사진 미저장(실험 모드는 동의 후), 보호자 동의 체크, 처리방침은 책임멘토 검토 |
| 네이버 API 이용 조건(출처 표기·저장 범위) | 출처 표기, 가격을 저장하지 않는 설계, 이용약관을 직접 읽고 확인 결과를 PROGRESS.md에 기록 |
| 모델 교체·종료 | 모델 ID는 env, 요금표는 한 파일 |

---

## 부록 A — 규격 파서 테스트 케이스

합성 예시로 시작한다. 실제 검색 결과에서 파서가 틀릴 때마다 여기에 추가한다(이 표가 늘어나는 것 자체가 매칭 실력의 기록이다). `—` = 혼합 상품이라 값을 비교하지 않음.

| # | 제목 | 개당 용량 | 단위 | 개수 | 메모 |
|---|---|---|---|---|---|
| 1 | `다우니 섬유유연제 실내건조 2.6L` | 2600 | ml | 1 | |
| 2 | `다우니 실내건조 섬유유연제 2.6L x 2개` | 2600 | ml | 2 | |
| 3 | `다우니 섬유유연제 실내건조 2.6Lx3` | 2600 | ml | 3 | 붙여 쓴 x |
| 4 | `다우니 2.6L*4입 1박스` | 2600 | ml | 4 | 1박스는 ×1 |
| 5 | `[본사직영] 다우니 실내건조 2.6L 2개 + 증정 1L` | 2600 | ml | 2 | hasGift, 증정 1L은 무시 |
| 6 | `다우니 섬유유연제 리필 1.6L / 2.6L 택1` | — | — | — | isMixed |
| 7 | `코디 3겹 데코 화장지 30m 30롤` | 30 | m | 30 | '3겹'은 개수 아님 |
| 8 | `코디 데코 3겹 30m 30롤 x 2팩` | 30 | m | 60 | |
| 9 | `[무료배송] 깨끗한나라 순수 3겹 30m 30롤 2팩 + 미용티슈 증정` | 30 | m | 60 | hasGift |
| 10 | `농심 신라면 120g 5개입` | 120 | g | 5 | |
| 11 | `농심 신라면 멀티팩 (120g x 5) x 4` | 120 | g | 20 | |
| 12 | `오뚜기 진라면 매운맛 120g x 5입 x 8팩 (40개)` | 120 | g | 40 | 괄호는 확인용 |
| 13 | `(10개묶음) 신라면 120g` | 120 | g | 10 | |
| 14 | `농심 신라면 40봉 1박스` | null | null | 40 | 용량 표기 없음 |
| 15 | `햇반 210g x 24개` | 210 | g | 24 | |
| 16 | `CJ 햇반 210g 12개 + 210g 12개 (총 24개)` | 210 | g | 24 | 같은 용량 묶음은 더함 |
| 17 | `제주삼다수 2L x 6병` | 2000 | ml | 6 | |
| 18 | `제주삼다수 2L 12병 (6병x2팩)` | 2000 | ml | 12 | 괄호를 곱하지 않음 |
| 19 | `동원참치 라이트스탠다드 150g 10캔` | 150 | g | 10 | |
| 20 | `동원참치 135g*8캔` | 135 | g | 8 | |
| 21 | `맥심 모카골드 마일드 커피믹스 180T` | null | null | 180 | ea 상품 |
| 22 | `맥심 모카골드 12g x 180개입` | 12 | g | 180 | |
| 23 | `크리넥스 마이비데 물티슈 캡형 70매 x 10팩` | 70 | sheet | 10 | |
| 24 | `베베숲 물티슈 오리지널 100매 10팩 (총 1000매)` | 100 | sheet | 10 | 괄호는 확인용 |
| 25 | `페리오 46cm 치약 100g 3개입` | 100 | g | 3 | '46cm'는 용량 아님 |
| 26 | `샘표 진간장 금F3 1.7L` | 1700 | ml | 1 | 'F3'는 개수 아님 |
| 27 | `1+1 해피홈 에어로솔 500ml` | 500 | ml | 2 | |
| 28 | `아이깨끗해 핸드워시 리필 450ml 3+1` | 450 | ml | 4 | |
| 29 | `피죤 섬유유연제 3100ml` | 3100 | ml | 1 | |
| 30 | `피죤 3.1L 2개입 (총 6.2L)` | 3100 | ml | 2 | 괄호 총량은 확인용 |
| 31 | `스파크 세제 2kg` | 2000 | g | 1 | |
| 32 | `칠성사이다 500ml x 20개` | 500 | ml | 20 | |
| 33 | `코카콜라 제로 355ml 24캔` | 355 | ml | 24 | |
| 34 | `코카콜라 제로 190ml x 30캔 / 355ml x 24캔 골라담기` | — | — | — | isMixed |
| 35 | `CJ 스팸 클래식 200g x 10개 + 340g 2개` | — | — | — | isMixed(용량 두 개) |
| 36 | `농심 새우깡 90g x 20봉` | 90 | g | 20 | |
| 37 | `1.8L 3개 x 2세트` | 1800 | ml | 6 | |
| 38 | `비트 액체세제 3L 일반드럼겸용 리필 1.8L x 2` | — | — | — | isMixed(용량 두 개) |
| 39 | `다우니 섬유유연제 실내건조 2.6L (2.6L x 1개)` | 2600 | ml | 1 | 괄호 중복 |
| 40 | `해피홈 물티슈 100매 x 10팩 x 2박스` | 100 | sheet | 20 | |

---

## 부록 B — 큐레이션 CSV (`products.csv`)

```
barcode,brand,name,variant,category,per_item_amount,per_item_unit,item_count,search_query,notes
(실제 바코드),다우니,섬유유연제,실내건조,세탁,2600,ml,1,다우니 섬유유연제 실내건조 2.6L,
(실제 바코드),코디,3겹 데코 화장지,,종이,30,m,30,코디 데코 3겹 30m 30롤,롤당 길이는 포장에서 확인
(실제 바코드),맥심,모카골드 마일드 커피믹스,,가공식품,,ea,180,맥심 모카골드 마일드 180T,
```
- 30개 구성 권장: 세탁 5 / 주방 3 / 욕실 5 / 종이 4 / 가공식품 8 / 음료 5.
- 제외: 신선식품(규격이 없음), 주류·의약품(온라인 판매가 제한됨).
- 우리 집이 실제로 반복해서 사는 것 위주로. 이게 재구매 기록의 첫 데이터가 된다.
- 값은 전부 실물 포장을 보고 사람이 입력한다(지원서 Q4-1의 "사람이 직접 확인해 연결").

---

## 부록 C — 문구 초안 (ko / en) — 기령이 최종 수정

| 키 | ko | en |
|---|---|---|
| home.cta | 가격표 찍기 | Scan a price tag |
| capture.hint | 가격표가 화면을 꽉 채우게, 반사 없이 찍어 주세요. | Fill the frame with the price tag and avoid glare. |
| confirm.title | 이 상품 맞아요? | Is this the product? |
| confirm.check | 확인해 주세요 | Please check |
| confirm.cta | 맞아요, 비교하기 | Yes, compare |
| verdict.storeCheaper.title | 마트가 {diff}원 더 싸요 | The store is ₩{diff} cheaper |
| verdict.storeCheaper.sub | 같은 상품, 같은 용량 기준이에요. 오늘은 그냥 카트에 넣으세요. | Same product, same size. Just put it in your cart. |
| verdict.samePrice.title | 마트와 온라인 가격이 같아요 | Same price as online |
| verdict.samePrice.sub | 배송을 기다릴 이유가 없어요. | No reason to wait for delivery. |
| verdict.onlineCheaper.title | 온라인이 {diff}원 싸요 | Online is ₩{diff} cheaper |
| verdict.onlineCheaper.sub | 배송비가 {diff}원보다 적을 때만이에요. | Only if shipping costs less than ₩{diff}. |
| verdict.closeCall | 차이가 작아서 배송비에 따라 뒤집힐 수 있어요. | The gap is small. Shipping could flip it. |
| verdict.bundleOnly.online | 같은 수량은 못 찾았지만, 큰 묶음이 단위가격으로 {pct}% 싸요 | No same-size match, but a bigger pack is {pct}% cheaper per unit |
| verdict.bundleOnly.store | 같은 수량은 못 찾았고, 단위가격으로도 마트가 싸거나 비슷해요 | No same-size match, and the store is cheaper or about the same per unit |
| bundle.insight | {count}개 묶음은 {unitLabel} {pct}% 싸요. 대신 한 번에 {total}원을 내요. 그만큼 쓸 때만 이득이에요. | A {count}-pack is {pct}% cheaper {unitLabel}, but you pay ₩{total} at once. Only worth it if you'll use that much. |
| verdict.noMatch.title | 온라인에서 같은 상품을 확실히 찾지 못했어요 | Couldn't confirm the same product online |
| verdict.noMatch.sub | 비슷한 상품은 아래 '확인 필요'에 있어요. 그중 어떤 것도 더 싸다고 말하지 않아요. | Similar items are listed below, but we won't call any of them cheaper. |
| verdict.needPrice | 매장 가격을 입력해 주세요 | Enter the store price |
| receipt.title | 비교 영수증 | Comparison receipt |
| receipt.store / online | 매장 / 온라인 | Store / Online |
| receipt.diff | 차액 | Difference |
| receipt.breakEven | 손익분기 배송비 | Break-even shipping |
| receipt.shippingUnknown | 배송비 미확인 | Shipping not checked |
| catalog.mall | 네이버 가격비교(여러 판매처) | Naver price comparison (multiple sellers) |
| evidence.title | 같은 상품으로 본 이유 | Why we matched these |
| evidence.items | 브랜드 / 제품 / 종류 / 개당 용량 / 수량 | Brand / Product / Type / Size / Count |
| scope | {time}에 네이버 쇼핑 검색 결과 {n}개를 확인했어요. 쿠팡 가격은 아직 포함되지 않아요. | Checked {n} Naver Shopping results at {time}. Coupang prices aren't included yet. |
| commission | 이 앱은 지금 어떤 판매처에서도 수수료를 받지 않아요. | This app doesn't earn commission from any seller right now. |
| section.bundles | 묶음·다른 용량 (단위가격으로 비교) | Other pack sizes (compared by unit price) |
| section.uncertain | 확인 필요 (추천하지 않아요) | Needs checking (not recommended) |
| action.buyStore | 마트에서 살게요 | Buying here |
| action.buyOnline | 온라인으로 살게요 | Buying online |
| action.skip | 안 살래요 | Not buying |
| action.bought | 샀어요 | Bought it |
| next.ask | 다음엔 언제쯤 다시 살 것 같아요? | When will you need it again? |
| lastPurchase | 지난번엔 {date} {channel}에서 {price}원에 샀어요. | Last time: ₩{price} at {channel} on {date}. |
| promo.banner | {promo} 행사 중이에요. {count}개 기준으로 비교할까요? | {promo} deal on now. Compare for {count} items? |
| link.same / notSame | 같은 상품 맞아요 / 아니에요 | Same product / Not the same |
| report | 결과가 이상해요 | Something's wrong |
| degraded | 일부 확인을 건너뛰었어요. | Some checks were skipped. |
| error.unreadable | 가격표를 읽지 못했어요. 가격표가 화면을 꽉 채우게 다시 찍어 주세요. | Couldn't read the tag. Fill the frame with the tag and try again. |
| error.network | 연결이 약해요. 다시 시도하거나 직접 입력하세요. | Weak connection. Try again or enter it by hand. |
| error.naver | 온라인 가격을 지금 확인할 수 없어요. 잠시 후 다시 시도하세요. | Can't check online prices right now. Try again in a moment. |
| demo.recorded | 녹화된 데모 결과예요({time} 기준). 실시간 가격이 아니에요. | Recorded demo from {time}. Not live prices. |

`{unitLabel}` 예: ko "100ml당", en "per 100ml".

---

## 부록 D — 판정 테스트 케이스 (`decide()`)

| # | 입력 | 기대 결과 |
|---|---|---|
| 1 | 매장 9,980원, 2.6L×1 / SAME_ITEM 2.6L×1 8,900원 | ONLINE_CHEAPER, diff 1,080, breakEvenShipping 1,080, closeCall true, 매장 단위가격 384 (100ml당) |
| 2 | 매장 8,500원 / 같은 후보 8,900원 | STORE_CHEAPER, diff 400 |
| 3 | 매장 8,900원 / 같은 후보 8,900원 | SAME_PRICE |
| 4 | 매장 15,900원, 30m×30롤 / SAME_ITEM 30m×60롤 27,800원(같은 수량 없음) | BUNDLE_ONLY, unitWinner online, 매장 177 vs 묶음 154 (10m당), bundleInsight pct 13, count 60, total 27,800 |
| 5 | 매장 4,980원, 120g×5 / SAME_ITEM 120g×5 3,900원 + SAME_ITEM 120g×40 26,000원 | ONLINE_CHEAPER diff 1,080, closeCall true + bundleInsight pct 35 (830 vs 542, 100g당), count 40, total 26,000 |
| 6 | 후보가 전부 UNCERTAIN | NO_MATCH |
| 7 | 매장 9,980원 / SAME_ITEM 2.6L×1 8,900원 + UNCERTAIN 5,000원 | ONLINE_CHEAPER diff 1,080 (UNCERTAIN 무시) |
| 8 | 매장 9,980원, 2.6L×1, 1+1 적용 / SAME_ITEM 2.6L×1 8,900원 + SAME_ITEM 2.6L×2 16,500원 | 매장 기준 (9,980원, 2개) → STORE_CHEAPER diff 6,520, 매장 단위가격 192 (100ml당), bundleInsight 없음 |
| 9 | ONLINE_CHEAPER에서 diff 3,000 / diff 2,999 | closeCall false / true |
| 10 | storePrice null | NEED_STORE_PRICE |
| 11 | 매장 9,980원, 2.6L×1 / SAME_ITEM 2.6L×1 10,500원 + SAME_ITEM 2.6L×2 19,580원 | STORE_CHEAPER diff 520, 묶음은 단위가격 1.9%만 낮아서 bundleInsight 없음 |
| 12 | 매장 9,980원, 2.6L×1 / SIZE_DIFF 1.6L×1 7,900원만 있음 | BUNDLE_ONLY, unitWinner store (494 vs 384, 100ml당) |
| 13 | 매장 3,000원, 500ml×1, 2+1 적용 / SAME_ITEM 500ml×3 6,600원 | 매장 기준 (6,000원, 3개) → STORE_CHEAPER diff 600 |
