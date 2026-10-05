import { useNavigate } from 'react-router';
import { TextButton } from '../../components/common/Button';
import { StoreChips, useStoreChoice } from '../../components/common/StoreChips';
import { TextLink } from '../../components/common/TextLink';
import { copy } from '../../lib/i18n';
import { CaptureButton } from '../capture/CaptureButton';
import { startManualEntry } from '../capture/manualEntry';

export function HomePage() {
  const navigate = useNavigate();
  const [store, setStore] = useStoreChoice();
  return (
    // fills the screen above the footer so the main action sits at thumb height
    <section className="flex min-h-[calc(100dvh-9rem)] flex-col gap-6 pt-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-[30px] leading-tight font-extrabold">{copy.app.name}</h1>
        <p className="text-[17px]">{copy.app.tagline}</p>
      </header>
      <StoreChips value={store} onChange={setStore} />
      <div className="mt-auto flex flex-col gap-3 pt-4">
        <p className="text-[15px]" id="capture-hint">
          {copy.capture.hint}
        </p>
        <CaptureButton />
        <div className="flex flex-wrap gap-x-6">
          <TextButton
            onClick={() => {
              startManualEntry();
              void navigate('/confirm');
            }}
          >
            {copy.home.manualEntry}
          </TextButton>
          <TextLink to="/about">{copy.home.aboutLink}</TextLink>
        </div>
      </div>
    </section>
  );
}
