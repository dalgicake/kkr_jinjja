# fixtures/tags — 가격표 읽기 평가셋 (PLAN 7.4, H0-2·H1-1)

마트에서 찍은 가격표 사진과, 사람이 확인한 정답 JSON을 둔다. `npm run eval:tags`가 사진마다
앱과 **같은 코드**(`server/readTag.ts`의 `handleReadTag`: 사진 검사 → 프롬프트 → tool 호출 → zod → 1회 재시도 → 15초 제한)로
읽고 정답과 비교해 `_report.md`를 만든다. Supabase에는 아무것도 쓰지 않는다(api_calls도 기록 안 함, 비용은 보고서에만).

## 파일

| 파일 | 누가 | 내용 |
|---|---|---|
| `001.jpg`, `002.jpg` … | 기령 | 가격표 사진. 숫자 3자리 이상. `.jpg`·`.jpeg`·`.png`·`.webp` |
| `001.json` | 기령 | **정답.** 사진을 보고 칸마다 확인한 값 |
| `001.draft.json` | 스크립트(`--draft`) | 모델이 읽은 **초안**. 정답이 아니다 |
| `_report.md` | 스크립트 | 필드별·매장별·사진별 정확도 |

- 사진은 4MB 이하여야 한다(앱과 같은 제한). 크면 맥 터미널에서 `sips -Z 2048 001.jpg`로 줄인다.
- 아이폰 HEIC는 안 된다. 사진 앱에서 JPG로 내보내거나 `sips -s format jpeg IMG.heic --out 001.jpg`.

## 순서

1. 사진을 `001.jpg`부터 넣는다(25~30장, 행사 가격표 5장 이상, 기울거나 반사된 사진 몇 장).
2. `.env.local`에 `ANTHROPIC_API_KEY`를 넣는다(BLOCKED.md B0-2).
3. 초안 만들기: `npm run eval:tags -- --draft` → 정답이 없는 사진마다 `NNN.draft.json`이 생긴다.
   이미 있는 초안은 건너뛴다(`--force`면 초안만 다시 만든다). `NNN.json`은 절대 만들거나 고치지 않는다.
4. **사진을 옆에 띄우고 칸마다** 초안을 고친다. 훑어보고 승인만 하면 평가가 의미 없어진다(7.4).
   - `_meta.storeName`에 매장 이름(예: `"이마트"`)을 적으면 매장별 표가 생긴다. 모르면 `null`.
   - 다 확인했으면 `_meta.draft`를 `false`로 바꾸고 파일 이름을 `NNN.json`으로 바꾼다.
     `draft`가 `true`인 정답 파일은 채점에서 빠진다.
5. 평가: `npm run eval:tags` → `_report.md`. 표를 PROGRESS.md에 옮긴다.
6. 모델 비교: `MODEL_TAG=claude-haiku-4-5-20251001 npm run eval:tags`. 보고서가 덮어써지니 먼저 결과를 PROGRESS.md에 옮기거나 파일을 복사해 둔다.

## 정답 JSON 쓰는 법

`shared/tag.ts`의 TagReading과 같은 모양이다(record_tag 도구와 같은 필드). `_meta`는 평가용 메모라 채점에 쓰이지 않는다.

```json
{
  "_meta": { "draft": false, "storeName": "이마트" },
  "image_kind": "shelf_tag",
  "product_name_raw": "다우니 섬유유연제 실내건조 2.6L",
  "brand": "다우니",
  "product_name": "섬유유연제 실내건조",
  "variant": "실내건조",
  "per_item_amount": 2600,
  "per_item_unit": "ml",
  "item_count": 1,
  "store_price": 9980,
  "regular_price": 12900,
  "promo": { "type": "none", "text": null, "n": null, "m": null },
  "tag_unit_price": { "price": 384, "per_amount": 100, "per_unit": "ml" },
  "barcode_digits": null,
  "multiple_tags_visible": false,
  "confidence": { "product": 1, "size": 1, "price": 1 },
  "notes": null
}
```

(위 값은 형식 예시일 뿐 실제 가격이 아니다.)

- 가격표에 **인쇄된 것만** 적는다. 안 보이거나 인쇄되지 않은 값은 `null`. 추측해서 채우지 않는다.
- `store_price`: 지금 내는 가격(정수 원). 행사가와 정상가가 같이 있으면 행사가. 1+1이어도 가격은 바꾸지 않는다.
- `per_item_amount` + `per_item_unit`: **한 개**의 용량. 단위는 `ml`·`g`·`m`(휴지 롤당 길이)·`sheet`(물티슈 팩당 매수)·`ea`(개수로만 파는 상품).
  `"2.6"`+`"L"`, `"1.5"`+`"kg"`처럼 적어도 자동으로 ml·g로 바뀐다.
- `item_count`: 그 가격으로 사는 개수. `30롤` → 30, `120g×5입×4` → 20.
- `promo.type`: `none` / `n_plus_m`(1+1, 2+1) / `percent_off` / `card_discount` / `multi_buy` / `other`.
- `confidence`는 채점에 쓰지 않는다. 형식 때문에 있으니 초안 값 그대로 두거나 1로 둔다.

## 채점 기준 (7.4)

| 항목 | 맞음의 기준 | Phase 1 수용 기준 |
|---|---|---|
| 매장가 | 정확히 일치 | ≥ 95% |
| 브랜드 | 대소문자·띄어쓰기·문장부호를 없앤 뒤 일치 | ≥ 85% |
| 개당 용량 | 정답과 1% 이내 + 단위 일치 | — |
| 수량 | 일치 | — |
| 용량+수량 | 둘 다 맞음 | ≥ 85% |
| 행사 유형 | 일치 | — |
| 종류 | 정규화 후 일치 — **참고용**, 수용 기준 아님 | — |

- 앱에서 실패하는 사진(422 읽지 못함, 시간 초과, 4MB 초과 등)은 모든 항목을 오답으로 센다.
- 정답이 `null`이고 모델도 `null`이면 맞음으로 센다.
- 모든 호출이 모델 API 오류(키·네트워크·모델 이름)로 실패하면 보고서를 쓰지 않고 멈춘다.
