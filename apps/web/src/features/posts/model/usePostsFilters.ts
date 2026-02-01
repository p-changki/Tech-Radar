import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CATEGORIES,
  CONTENT_TYPES,
  SIGNALS,
  STATUSES,
  LOOKBACK_OPTIONS
} from '../../../shared/constants/categories';

const defaultQuery = {
  q: '',
  category: 'all',
  contentType: 'all',
  signal: 'all',
  sort: 'desc' as 'asc' | 'desc',
  status: 'all',
  collection: '',
  pinnedOnly: false,
  lookbackDays: 'all'
} as const;

const LOOKBACK_VALUES = LOOKBACK_OPTIONS.map((option) => option.value);

export type PostsFiltersState = {
  query: string;
  debouncedQuery: string;
  sortOrder: 'asc' | 'desc';
  categoryFilter: 'all' | (typeof CATEGORIES)[number];
  contentTypeFilter: 'all' | (typeof CONTENT_TYPES)[number];
  signalFilter: 'all' | (typeof SIGNALS)[number];
  statusFilter: 'all' | (typeof STATUSES)[number];
  collectionFilter: string;
  pinnedOnly: boolean;
  lookbackDays: (typeof LOOKBACK_OPTIONS)[number]['value'];
};

export type PostsFiltersSetters = {
  setQuery: (value: string) => void;
  setSortOrder: (value: 'asc' | 'desc') => void;
  setCategoryFilter: (value: PostsFiltersState['categoryFilter']) => void;
  setContentTypeFilter: (value: PostsFiltersState['contentTypeFilter']) => void;
  setSignalFilter: (value: PostsFiltersState['signalFilter']) => void;
  setStatusFilter: (value: PostsFiltersState['statusFilter']) => void;
  setCollectionFilter: (value: string) => void;
  setPinnedOnly: (value: boolean) => void;
  setLookbackDays: (value: PostsFiltersState['lookbackDays']) => void;
};

export type UsePostsFiltersReturn = PostsFiltersState &
  PostsFiltersSetters & {
    buildQuery: (cursor?: string) => string;
    updateUrl: (selectedId?: string | null) => void;
  };

export function usePostsFilters(): UsePostsFiltersReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState<string>(defaultQuery.q);
  const [debouncedQuery, setDebouncedQuery] = useState<string>(defaultQuery.q);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultQuery.sort);
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | (typeof CATEGORIES)[number]
  >('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<
    'all' | (typeof CONTENT_TYPES)[number]
  >('all');
  const [signalFilter, setSignalFilter] = useState<'all' | (typeof SIGNALS)[number]>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | (typeof STATUSES)[number]>('all');
  const [collectionFilter, setCollectionFilter] = useState<string>(defaultQuery.collection);
  const [pinnedOnly, setPinnedOnly] = useState<boolean>(defaultQuery.pinnedOnly);
  const [lookbackDays, setLookbackDays] = useState<
    (typeof LOOKBACK_OPTIONS)[number]['value']
  >(defaultQuery.lookbackDays);

  useEffect(() => {
    const q = searchParams.get('q') ?? defaultQuery.q;
    const category = (searchParams.get('category') ?? defaultQuery.category) as typeof categoryFilter;
    const contentType = (searchParams.get('contentType') ??
      defaultQuery.contentType) as typeof contentTypeFilter;
    const signal = (searchParams.get('signal') ?? defaultQuery.signal) as typeof signalFilter;
    const sort = (searchParams.get('sort') ?? defaultQuery.sort) as typeof sortOrder;
    const status = (searchParams.get('status') ?? defaultQuery.status) as typeof statusFilter;
    const collection = searchParams.get('collection') ?? defaultQuery.collection;
    const pinned = searchParams.get('pinnedOnly') === 'true';
    const rawLookback = searchParams.get('lookbackDays') ?? defaultQuery.lookbackDays;
    const lookback = LOOKBACK_VALUES.includes(rawLookback as (typeof LOOKBACK_OPTIONS)[number]['value'])
      ? (rawLookback as (typeof LOOKBACK_OPTIONS)[number]['value'])
      : defaultQuery.lookbackDays;

    setQuery(q);
    setDebouncedQuery(q);
    setCategoryFilter(category);
    setContentTypeFilter(contentType);
    setSignalFilter(signal);
    setSortOrder(sort === 'asc' ? 'asc' : 'desc');
    setStatusFilter(status);
    setCollectionFilter(collection);
    setPinnedOnly(pinned);
    setLookbackDays(lookback);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const updateUrl = useCallback(
    (selectedId?: string | null) => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (contentTypeFilter !== 'all') params.set('contentType', contentTypeFilter);
      if (signalFilter !== 'all') params.set('signal', signalFilter);
      if (sortOrder !== 'desc') params.set('sort', sortOrder);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (collectionFilter) params.set('collection', collectionFilter);
      if (pinnedOnly) params.set('pinnedOnly', 'true');
      if (lookbackDays !== 'all') params.set('lookbackDays', lookbackDays);
      if (selectedId) params.set('selected', selectedId);
      const qs = params.toString();
      router.replace(qs ? `/posts?${qs}` : '/posts', { scroll: false });
    },
    [
      debouncedQuery,
      categoryFilter,
      contentTypeFilter,
      signalFilter,
      sortOrder,
      statusFilter,
      collectionFilter,
      pinnedOnly,
      lookbackDays,
      router
    ]
  );

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (cursor) params.set('cursor', cursor);
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (contentTypeFilter !== 'all') params.set('contentType', contentTypeFilter);
      if (signalFilter !== 'all') params.set('signal', signalFilter);
      params.set('sort', sortOrder);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (collectionFilter) params.set('collection', collectionFilter);
      if (pinnedOnly) params.set('pinnedOnly', 'true');
      if (lookbackDays !== 'all') params.set('lookbackDays', lookbackDays);
      return params.toString();
    },
    [
      debouncedQuery,
      categoryFilter,
      contentTypeFilter,
      signalFilter,
      sortOrder,
      statusFilter,
      collectionFilter,
      pinnedOnly,
      lookbackDays
    ]
  );

  return {
    query,
    debouncedQuery,
    sortOrder,
    categoryFilter,
    contentTypeFilter,
    signalFilter,
    statusFilter,
    collectionFilter,
    pinnedOnly,
    lookbackDays,
    setQuery,
    setSortOrder,
    setCategoryFilter,
    setContentTypeFilter,
    setSignalFilter,
    setStatusFilter,
    setCollectionFilter,
    setPinnedOnly,
    setLookbackDays,
    buildQuery,
    updateUrl
  };
}
