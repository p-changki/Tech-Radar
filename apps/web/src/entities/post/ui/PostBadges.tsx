import { memo } from 'react';
import { Badge } from '../../../shared/ui';
import { CATEGORY_LABELS, STATUS_LABELS } from '../../../shared/constants/categories';

type Props = {
  category?: string | null;
  signals?: string[];
  status?: string | null;
  contentType?: string | null;
  collection?: string | null;
  pinned?: boolean | null;
  maxSignals?: number;
};

function PostBadges({
  category,
  signals = [],
  status,
  contentType,
  collection,
  pinned,
  maxSignals = 3
}: Props) {
  const visibleSignals = signals.slice(0, maxSignals);
  const extraCount = Math.max(0, signals.length - visibleSignals.length);

  return (
    <>
      {category && (
        <Badge>{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}</Badge>
      )}
      {status && (
        <Badge>{STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}</Badge>
      )}
      {collection && <Badge>{collection}</Badge>}
      {pinned && <Badge>⭐ Pinned</Badge>}
      {contentType && <Badge>{contentType}</Badge>}
      {visibleSignals.map((signal) => (
        <Badge key={signal}>{signal}</Badge>
      ))}
      {extraCount > 0 && <Badge>+{extraCount}</Badge>}
    </>
  );
}

export default memo(PostBadges);
