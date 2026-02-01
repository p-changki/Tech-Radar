import { memo } from 'react';
import type { UsePostsFiltersReturn } from '../model/usePostsFilters';
import { CATEGORIES, CATEGORY_LABELS, CONTENT_TYPES, SIGNALS, STATUSES, STATUS_LABELS, LOOKBACK_OPTIONS } from '../../../shared/constants/categories';

type Props = {
  filters: UsePostsFiltersReturn;
};

function PostsFilterBar({ filters }: Props) {
  return (
    <div className="input-grid" style={{ marginTop: 12 }}>
      <label>
        검색
        <input
          value={filters.query}
          onChange={(event) => filters.setQuery(event.target.value)}
          placeholder="제목/요약/URL/메모"
        />
      </label>
      <label>
        정렬
        <select
          value={filters.sortOrder}
          onChange={(event) => filters.setSortOrder(event.target.value as 'asc' | 'desc')}
        >
          <option value="desc">최신순</option>
          <option value="asc">오래된순</option>
        </select>
      </label>
      <label>
        카테고리
        <select
          value={filters.categoryFilter}
          onChange={(event) =>
            filters.setCategoryFilter(event.target.value as 'all' | (typeof CATEGORIES)[number])
          }
        >
          <option value="all">전체</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </label>
      <label>
        타입
        <select
          value={filters.contentTypeFilter}
          onChange={(event) =>
            filters.setContentTypeFilter(
              event.target.value as 'all' | (typeof CONTENT_TYPES)[number]
            )
          }
        >
          <option value="all">전체</option>
          {CONTENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label>
        시그널
        <select
          value={filters.signalFilter}
          onChange={(event) =>
            filters.setSignalFilter(event.target.value as 'all' | (typeof SIGNALS)[number])
          }
        >
          <option value="all">전체</option>
          {SIGNALS.map((signal) => (
            <option key={signal} value={signal}>
              {signal}
            </option>
          ))}
        </select>
      </label>
      <label>
        상태
        <select
          value={filters.statusFilter}
          onChange={(event) =>
            filters.setStatusFilter(event.target.value as 'all' | (typeof STATUSES)[number])
          }
        >
          <option value="all">전체</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label>
        컬렉션
        <input
          value={filters.collectionFilter}
          onChange={(event) => filters.setCollectionFilter(event.target.value)}
          placeholder="예: security, onboarding"
        />
      </label>
      <label>
        고정만 보기
        <select
          value={filters.pinnedOnly ? 'true' : 'false'}
          onChange={(event) => filters.setPinnedOnly(event.target.value === 'true')}
        >
          <option value="false">전체</option>
          <option value="true">Pinned</option>
        </select>
      </label>
      <label>
        기간
        <select
          value={filters.lookbackDays}
          onChange={(event) =>
            filters.setLookbackDays(event.target.value as (typeof LOOKBACK_OPTIONS)[number]['value'])
          }
        >
          {LOOKBACK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default memo(PostsFilterBar);
