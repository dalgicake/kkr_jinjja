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
