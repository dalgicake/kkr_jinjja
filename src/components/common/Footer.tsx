import { CommissionNotice } from './CommissionNotice';
import { VersionBadge } from './VersionBadge';

export function Footer() {
  return (
    <footer className="mt-auto flex flex-col gap-1 pt-8 pb-6">
      <CommissionNotice />
      <VersionBadge />
    </footer>
  );
}
