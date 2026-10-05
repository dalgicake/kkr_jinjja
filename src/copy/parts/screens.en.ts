import type { Copy } from '../ko';

/** en copy, `screens` namespace (/screens tour). Typed against ko. */
export const enScreens: Copy['screens'] = {
  title: 'Screen tour',
  sub: "Every screen in one place. Lookups aren't connected yet, so all numbers you'll see are examples.",
  homeLink: 'Screen tour',
  code: 'S{n}',
  groups: {
    app: 'Main screens',
    results: 'Result types',
    resultsSub: 'One example for each verdict on the comparison receipt.',
    demo: 'Demo',
    team: 'Team only',
    teamSub: 'For the field test and admin. Any passcode works for now.',
  },
  items: {
    home: { name: 'Home', desc: 'Scan button, store chips and recent records.' },
    confirm: {
      name: 'Confirm card',
      desc: 'Check what was read from the tag. Empty until you scan or type.',
    },
    history: { name: 'Records', desc: 'Planned online buys and confirmed purchases.' },
    about: { name: 'About', desc: 'The seven promises, privacy and data source.' },
    account: {
      name: 'My account',
      desc: 'Optional sign-in, nickname, language, sign out and delete account.',
    },
    demo: { name: 'Demo picker', desc: 'Pick one of three recorded examples.' },
    demoTag: { name: 'Demo step 1: price tag', desc: 'How a photographed tag looks.' },
    demoConfirm: {
      name: 'Demo step 2: confirm card',
      desc: 'What was read, with one field to check.',
    },
    demoResult: { name: 'Demo step 3: verdict', desc: 'The verdict and a link to its receipt.' },
    test: { name: 'Field test', desc: 'Own search vs. the app, then a short survey.' },
    admin: { name: 'Admin', desc: 'Product CSV, Naver candidate links and reports.' },
    stats: { name: 'Stats', desc: 'Scan, match and purchase numbers by period.' },
  },
  verdicts: {
    storeCheaper: 'When the store wins, it says so. The online link stays quiet.',
    samePrice: 'Same unit price at the store and online.',
    onlineCheaper: 'Online is cheaper by a clear gap. Shipping is still unknown.',
    onlineCloseCall: 'Online is a little cheaper. Shipping could flip it.',
    bundleOnline: 'No same pack online. A bigger pack is cheaper per unit.',
    bundleStore: 'Only other sizes online. Per unit, the store is cheaper.',
    noMatch: 'No same item found, so no verdict.',
    needPrice: 'The store price is missing. Type it in to compare.',
    promo: 'A 1+1 deal. The toggle recomputes for two items.',
  },
};
