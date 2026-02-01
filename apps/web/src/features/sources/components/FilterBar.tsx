'use client';

import type { Category } from '@tech-radar/shared';

const statusPresets = [
  { value: 'all', label: '전체' },
  { value: 'enabled', label: '활성' },
  { value: 'disabled', label: '비활성' },
  { value: 'failing', label: '실패' },
  { value: 'throttled', label: '차단/지연' }
] as const;

type StatusPreset = (typeof statusPresets)[number]['value'];

type Props = {
  query: string;
  locale: 'ko' | 'en' | 'all';
  category: 'all' | Category;
  sortKey: string;
  statusPreset: StatusPreset;
  onQueryChange: (value: string) => void;
  onLocaleChange: (value: 'ko' | 'en' | 'all') => void;
  onCategoryChange: (value: 'all' | Category) => void;
  onSortChange: (value: string) => void;
  onStatusPresetChange: (value: StatusPreset) => void;
  categories: Category[];
  categoryLabels: Record<Category, string>;
};

export default function FilterBar({
  query,
  locale,
  category,
  sortKey,
  statusPreset,
  onQueryChange,
  onLocaleChange,
  onCategoryChange,
  onSortChange,
  onStatusPresetChange,
  categories,
  categoryLabels
}: Props) {
  return (
    <div className="sources-filter">
      <div className="sources-filter-row">
        <label>
          검색
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="이름 또는 URL"
          />
        </label>
        <label>
          언어
          <select value={locale} onChange={(event) => onLocaleChange(event.target.value as 'ko' | 'en' | 'all')}>
            <option value="ko">국내</option>
            <option value="en">해외</option>
            <option value="all">전체</option>
          </select>
        </label>
        <label>
          카테고리
          <select value={category} onChange={(event) => onCategoryChange(event.target.value as 'all' | Category)}>
            <option value="all">전체</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {categoryLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          정렬
          <select value={sortKey} onChange={(event) => onSortChange(event.target.value)}>
            <option value="name">이름</option>
            <option value="recent">최근 수집</option>
            <option value="failures">실패 횟수</option>
          </select>
        </label>
      </div>

      <div className="sources-filter-row">
        <div className="sources-status">
          <span className="muted">상태</span>
          <div className="status-pills">
            {statusPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`status-pill ${statusPreset === preset.value ? 'active' : ''}`}
                onClick={() => onStatusPresetChange(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

