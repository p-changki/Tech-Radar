'use client';

import type { Source } from '../types';
import type { Category } from '@tech-radar/shared';
import { getDomain } from '../../../shared/lib/url';

type Props = {
  sources: Source[];
  selected: Set<string>;
  categoryLabels: Record<Category, string>;
  onToggleSelect: (id: string) => void;
  onToggleEnabled: (id: string, value: boolean) => void;
  onSelectRow: (source: Source) => void;
  onDeleteRow: (id: string) => void;
  onCopyUrl: (url: string) => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

export default function SourceTable({
  sources,
  selected,
  categoryLabels,
  onToggleSelect,
  onToggleEnabled,
  onSelectRow,
  onDeleteRow,
  onCopyUrl
}: Props) {
  if (sources.length === 0) {
    return <div className="muted">조건에 맞는 소스가 없습니다.</div>;
  }

  return (
    <div className="sources-table-wrap">
      <table className="sources-table">
        <thead>
          <tr>
            <th />
            <th>소스</th>
            <th>카테고리/언어</th>
            <th>상태</th>
            <th>마지막 수집</th>
            <th>실패</th>
            <th>가중치</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => {
            const failureCount = source.consecutiveFailures ?? 0;
            const autoDisabled = !source.enabled && failureCount >= 5;
            const isFailing = failureCount >= 3 || (source.lastStatus && source.lastStatus >= 500);
            const isThrottled = source.lastStatus === 429 || source.lastStatus === 403;
            return (
              <tr key={source.id} onClick={() => onSelectRow(source)}>
                <td onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(source.id)}
                    onChange={() => onToggleSelect(source.id)}
                  />
                </td>
                <td>
                  <div className="source-name">
                    <strong>{source.name}</strong>
                    <span className="muted">{getDomain(source.key)}</span>
                  </div>
                  <div className="muted clamp-1">{source.key}</div>
                </td>
                <td>
                  <div className="badges">
                    <span className="badge">{categoryLabels[source.categoryDefault] ?? source.categoryDefault}</span>
                    <span className="badge">{source.locale.toUpperCase()}</span>
                  </div>
                </td>
                <td>
                  <div className="badges">
                    <span className={`badge ${source.enabled ? 'badge-active' : 'badge-inactive'}`}>
                      {source.enabled ? '활성' : '비활성'}
                    </span>
                    {isFailing && <span className="badge badge-warning">불안정</span>}
                    {isThrottled && <span className="badge badge-warning">제한</span>}
                    {autoDisabled && <span className="badge badge-danger">자동 비활성</span>}
                  </div>
                </td>
                <td className="muted">{formatDate(source.lastFetchedAt)}</td>
                <td className="muted">{failureCount || '-'}</td>
                <td className="muted">{typeof source.weight === 'number' ? source.weight.toFixed(1) : '-'}</td>
                <td onClick={(event) => event.stopPropagation()}>
                  <div className="source-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onToggleEnabled(source.id, !source.enabled)}
                    >
                      {source.enabled ? '끄기' : '켜기'}
                    </button>
                    <button type="button" className="secondary" onClick={() => onCopyUrl(source.key)}>
                      URL 복사
                    </button>
                    <button type="button" className="secondary" onClick={() => onDeleteRow(source.id)}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
