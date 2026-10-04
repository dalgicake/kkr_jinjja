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
