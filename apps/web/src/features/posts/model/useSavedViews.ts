import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SavedView } from '../../../entities/post';
import type { UsePostsFiltersReturn } from './usePostsFilters';

const STORAGE_KEY = 'tech-radar:savedViews:v1';

export const BASE_VIEWS: SavedView[] = [
  {
    id: '__all',
    name: 'All',
    createdAt: 'base',
    query: {}
  },
  {
    id: '__pinned',
    name: 'Pinned',
    createdAt: 'base',
    query: { pinnedOnly: 'true' }
  },
  {
    id: '__security7',
    name: 'Security (7d)',
    createdAt: 'base',
    query: { signal: 'security', lookbackDays: '7' }
  }
];

type UseSavedViewsArgs = {
  filters: UsePostsFiltersReturn;
};

export type UseSavedViewsReturn = {
  savedViews: SavedView[];
  saveView: () => void;
  applyView: (view?: SavedView) => void;
  deleteView: (id: string) => void;
  isViewActive: (view: SavedView) => boolean;
  activeViewId: string | null;
};

export function useSavedViews({ filters }: UseSavedViewsArgs): UseSavedViewsReturn {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SavedView[];
      if (Array.isArray(parsed)) setSavedViews(parsed);
    } catch {
      // ignore
    }
  }, []);

  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  };

  const saveView = () => {
    const name = window.prompt('저장할 뷰 이름을 입력하세요');
    if (!name) return;
    const existingNames = new Set(savedViews.map((view) => view.name.toLowerCase()));
    let finalName = name.trim();
    if (!finalName) return;
    let suffix = 1;
    while (existingNames.has(finalName.toLowerCase())) {
      suffix += 1;
      finalName = `${name.trim()} (${suffix})`;
    }
    const view: SavedView = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : String(Date.now()),
      name: finalName,
      createdAt: new Date().toISOString(),
      query: {
        q: filters.debouncedQuery || undefined,
        category: filters.categoryFilter !== 'all' ? filters.categoryFilter : undefined,
        contentType: filters.contentTypeFilter !== 'all' ? filters.contentTypeFilter : undefined,
        signal: filters.signalFilter !== 'all' ? filters.signalFilter : undefined,
        sort: filters.sortOrder,
        status: filters.statusFilter !== 'all' ? filters.statusFilter : undefined,
        collection: filters.collectionFilter || undefined,
        pinnedOnly: filters.pinnedOnly ? 'true' : undefined,
        lookbackDays: filters.lookbackDays !== 'all' ? filters.lookbackDays : undefined
      }
    };

    const next = [view, ...savedViews].slice(0, 20);
    persistViews(next);
  };

  const applyView = (view?: SavedView) => {
    if (!view) {
      filters.setQuery('');
      filters.setCategoryFilter('all');
      filters.setContentTypeFilter('all');
      filters.setSignalFilter('all');
      filters.setSortOrder('desc');
      filters.setStatusFilter('all');
      filters.setCollectionFilter('');
      filters.setPinnedOnly(false);
      filters.setLookbackDays('all');
      return;
    }
    filters.setQuery(view.query.q ?? '');
    filters.setCategoryFilter((view.query.category as UsePostsFiltersReturn['categoryFilter']) ?? 'all');
    filters.setContentTypeFilter(
      (view.query.contentType as UsePostsFiltersReturn['contentTypeFilter']) ?? 'all'
    );
    filters.setSignalFilter((view.query.signal as UsePostsFiltersReturn['signalFilter']) ?? 'all');
    filters.setSortOrder(view.query.sort ?? 'desc');
    filters.setStatusFilter((view.query.status as UsePostsFiltersReturn['statusFilter']) ?? 'all');
    filters.setCollectionFilter(view.query.collection ?? '');
    filters.setPinnedOnly(view.query.pinnedOnly === 'true');
    filters.setLookbackDays(
      (view.query.lookbackDays as UsePostsFiltersReturn['lookbackDays']) ?? 'all'
    );
  };

  const deleteView = (id: string) => {
    const next = savedViews.filter((view) => view.id !== id);
    persistViews(next);
  };

  const isViewActive = useCallback((view: SavedView) => {
    const q = view.query.q ?? '';
    const category = view.query.category ?? 'all';
    const contentType = view.query.contentType ?? 'all';
    const signal = view.query.signal ?? 'all';
    const sort = view.query.sort ?? 'desc';
    const status = view.query.status ?? 'all';
    const collection = view.query.collection ?? '';
    const pinned = view.query.pinnedOnly === 'true';
    const lookback = view.query.lookbackDays ?? 'all';
    return (
      q === filters.debouncedQuery &&
      category === filters.categoryFilter &&
      contentType === filters.contentTypeFilter &&
      signal === filters.signalFilter &&
      sort === filters.sortOrder &&
      status === filters.statusFilter &&
      collection === filters.collectionFilter &&
      pinned === filters.pinnedOnly &&
      lookback === filters.lookbackDays
    );
  }, [
    filters.debouncedQuery,
    filters.categoryFilter,
    filters.contentTypeFilter,
    filters.signalFilter,
    filters.sortOrder,
    filters.statusFilter,
    filters.collectionFilter,
    filters.pinnedOnly,
    filters.lookbackDays
  ]);

  const activeViewId = useMemo(() => {
    const allViews = [...BASE_VIEWS, ...savedViews];
    const matched = allViews.find((view) => isViewActive(view));
    return matched?.id ?? null;
  }, [savedViews, isViewActive]);

  return { savedViews, saveView, applyView, deleteView, isViewActive, activeViewId };
}
