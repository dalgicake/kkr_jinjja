import { CommissionNotice } from './CommissionNotice';
import { VersionBadge } from './VersionBadge';

export function Footer() {
  return (
    <footer className="mt-auto pt-10 pb-6">
      <div className="flex flex-col gap-1 border-t-2 border-ink pt-4">
        <CommissionNotice />
        <VersionBadge />
      </div>
    </footer>
  );
}
