/** 모든 UI 문구(ko). 키를 추가하면 en.ts에도 같은 키를 넣는다 — 타입이 강제한다. */
export const ko = {
  app: {
    name: '진짜?',
    tagline: '마트 가격표를 찍으면 온라인의 같은 상품과 비교해요.',
  },
  home: {
    comingSoon: '가격표 찍기는 준비 중이에요.',
    aboutLink: '안내',
  },
  commission: '이 앱은 지금 어떤 판매처에서도 수수료를 받지 않아요.',
  version: 'v{version}',
  about: {
    title: '안내',
    back: '홈으로',
    connection: '연결 상태',
  },
  auth: {
    loading: '연결하는 중이에요.',
    notConnected: '서버에 연결되지 않았어요.',
    signedIn: '익명 ID로 연결됐어요.',
    userId: '익명 ID: {id}',
    error: '익명 로그인에 실패했어요. 새로고침해 주세요.',
    noUser: '서버가 익명 ID를 돌려주지 않았어요.',
    errorDetail: '오류 내용: {message}',
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Copy = Widen<typeof ko>;
