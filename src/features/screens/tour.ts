import type { Tone } from '../../components/common/tone';
import type { Copy } from '../../copy/ko';
import { RESULT_FIXTURES } from '../result/fixtures';
import { headerTone } from '../result/resultView';

/** One row on /screens: where it goes, its PLAN 2 screen number, fill colour and copy. */
export interface TourStop {
  to: string;
  screen: number;
  tone: Tone;
  name: string;
  desc: string;
}

export interface TourGroup {
  id: 'app' | 'results' | 'demo' | 'team';
  tone: Tone;
  title: string;
  sub?: string;
  stops: readonly TourStop[];
}

type ItemKey = keyof Copy['screens']['items'];

const item = (t: Copy, key: ItemKey, to: string, screen: number, tone: Tone): TourStop => ({
  to,
  screen,
  tone,
  name: t.screens.items[key].name,
  desc: t.screens.items[key].desc,
});

/**
 * Every route in the app, grouped. Tones follow the fixed meanings (tone.ts) and match each
 * screen's own header colour, so a row looks like the screen it opens. /demo is neutral white
 * (never tangerine = promo or sky = online); the 1+1 example row is tangerine because it is a deal.
 */
export function tourGroups(t: Copy): readonly TourGroup[] {
  return [
    {
      id: 'app',
      tone: 'lime',
      title: t.screens.groups.app,
      stops: [
        item(t, 'home', '/', 0, 'lime'),
        item(t, 'confirm', '/confirm', 2, 'butter'),
        item(t, 'history', '/history', 4, 'lilac'),
        item(t, 'about', '/about', 9, 'sky'),
        item(t, 'account', '/account', 10, 'lilac'),
      ],
    },
    {
      id: 'results',
      tone: 'white',
      title: t.screens.groups.results,
      sub: t.screens.groups.resultsSub,
      stops: RESULT_FIXTURES.map((f) => ({
        to: `/preview/result/${f.id}`,
        screen: 3,
        // a deal example reads as a deal: tangerine = promo (its banner on the result screen)
        tone: f.promo.type === 'none' ? headerTone(f.verdict) : 'tangerine',
        name: t.result.preview.names[f.nameKey],
        desc: t.screens.verdicts[f.nameKey],
      })),
    },
    {
      id: 'demo',
      tone: 'white',
      title: t.screens.groups.demo,
      stops: [
        item(t, 'demo', '/demo', 5, 'white'),
        item(t, 'demoTag', '/demo?s=D1&step=1', 5, 'butter'),
        item(t, 'demoConfirm', '/demo?s=D2&step=2', 5, 'butter'),
        item(t, 'demoResult', '/demo?s=D3&step=3', 5, 'lime'),
      ],
    },
    {
      id: 'team',
      tone: 'lilac',
      title: t.screens.groups.team,
      sub: t.screens.groups.teamSub,
      stops: [
        item(t, 'test', '/test', 6, 'sky'),
        item(t, 'admin', '/admin', 7, 'butter'),
        item(t, 'stats', '/stats', 8, 'lilac'),
      ],
    },
  ];
}
