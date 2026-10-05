import { useNavigate } from 'react-router';
import { Button, ButtonLink } from '../../components/common/Button';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SectionBlock } from '../../components/common/SectionBlock';
import { StoreChips, useStoreChoice } from '../../components/common/StoreChips';
import { TextLink } from '../../components/common/TextLink';
import { useCopy } from '../../lib/language';
import { CaptureButton } from '../capture/CaptureButton';
import { startManualEntry } from '../capture/manualEntry';
import { BarcodeButton } from './BarcodeButton';
import { RecentRecords } from './RecentRecords';

/**
 * S0. Lime header, butter store chips (remembered), lilac recent records (example rows, labelled),
 * the big lime price-tag button at thumb height, then the other ways in. P7 notice and the version
 * sit in the layout footer below.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { t } = useCopy();
  const [store, setStore] = useStoreChoice();
  return (
    // fills the screen above the footer so the main action sits at thumb height
    <section className="flex min-h-[calc(100dvh-9rem)] flex-col gap-8">
      <ScreenHeader tone="lime" size="lg" title={t.app.name} sub={t.app.tagline} />

      <StoreChips value={store} onChange={setStore} />

      <RecentRecords />

      <div className="mt-auto flex flex-col gap-3">
        <p className="text-[15px] font-semibold" id="capture-hint">
          {t.capture.hint}
        </p>
        <CaptureButton />
      </div>

      <SectionBlock tone="white" id="home-more" title={t.home.moreTitle}>
        <div className="grid grid-cols-2 gap-3">
          <BarcodeButton />
          <Button
            tone="white"
            onClick={() => {
              startManualEntry();
              void navigate('/confirm');
            }}
          >
            {t.home.manualEntry}
          </Button>
        </div>
        <ButtonLink to="/demo" tone="sky">
          {t.home.demo}
        </ButtonLink>
        <div className="flex flex-wrap gap-x-6">
          <TextLink to="/about">{t.home.aboutLink}</TextLink>
          <TextLink to="/screens">{t.screens.homeLink}</TextLink>
        </div>
      </SectionBlock>
    </section>
  );
}
