'use client';

import type { Source } from '../types';
import type { Category } from '@tech-radar/shared';
import { getDomain } from '../../../shared/lib/url';

type Props = {
  source: Source | null;
  open: boolean;
  categoryLabels: Record<Category, string>;
  onClose: () => void;
  onToggleEnabled: (id: string, value: boolean) => void;
};

export default function SourceDetailDrawer({
  source,
  open,
  categoryLabels,
  onClose,
  onToggleEnabled
}: Props) {
  if (!open || !source) return null;

  return (
    <div role="presentation" className="modal-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h4>{source.name}</h4>
            <p className="muted">{getDomain(source.key)}</p>
          </div>
          <button type="button" className="secondary" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="drawer-body">
          <div className="badges">
            <span className="badge">{categoryLabels[source.categoryDefault] ?? source.categoryDefault}</span>
            <span className="badge">{source.locale.toUpperCase()}</span>
            <span className={`badge ${source.enabled ? 'badge-active' : 'badge-inactive'}`}>
              {source.enabled ? '활성' : '비활성'}
            </span>
          </div>
          <div className="muted">RSS: {source.key}</div>
          {source.lastFetchedAt && (
            <div className="muted">마지막 수집: {new Date(source.lastFetchedAt).toLocaleString()}</div>
          )}
          {typeof source.consecutiveFailures === 'number' && source.consecutiveFailures > 0 && (
            <div className="muted">연속 실패: {source.consecutiveFailures}</div>
          )}
          {source.lastError && (
            <div className="notice" style={{ marginTop: 8 }}>
              최근 오류: {source.lastError}
            </div>
          )}
          <label className="toggle" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={source.enabled}
              onChange={(event) => onToggleEnabled(source.id, event.target.checked)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span>{source.enabled ? '활성화됨' : '비활성'}</span>
          </label>
          {source.tags && source.tags.length > 0 && (
            <div className="tag-chips" style={{ marginTop: 12 }}>
              {source.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
