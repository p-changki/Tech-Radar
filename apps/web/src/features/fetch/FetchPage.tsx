'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Category } from '@tech-radar/shared';
import { apiFetch } from '../../lib/api';
import { CATEGORIES, CATEGORY_LABELS, LOOKBACK_OPTIONS } from '../../shared/constants/categories';
import { getDomain } from '../../shared/lib/url';

const categories: Category[] = [...CATEGORIES];
const categoryLabels: Record<Category, string> = CATEGORY_LABELS;

type SourceStatus = {
  sourceId: string;
  name: string;
  hostname?: string;
  status: number;
  fetchedCount: number;
  latencyMs?: number;
  domainConcurrencyApplied?: number;
  error?: string;
};

type FetchRunStatus = {
  runId: string;
  status: 'running' | 'success' | 'failed';
  sources?: SourceStatus[];
  counts?: {
    totalFetched?: number;
    totalStored?: number;
    sourceSuccess?: number;
    sourceNotModified?: number;
    sourceFailures?: number;
  };
  error?: string | null;
};

type Preset = {
  id: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  sourceCount?: number;
};

type FetchItemsResponse = {
  items: Array<{
    id: string;
    title: string;
    url: string;
    category: string;
    publishedAt: string;
    sourceName?: string | null;
    snippet?: string | null;
    contentTypeHint?: string | null;
    signals: string[];
  }>;
};

type InboxItem = FetchItemsResponse['items'][number];

const LOOKBACK_DAY_VALUES = LOOKBACK_OPTIONS
  .filter((option) => option.value !== 'all')
  .map((option) => Number(option.value))
  .filter((value) => Number.isFinite(value) && value > 0);
const LOOKBACK_SELECT_OPTIONS = LOOKBACK_OPTIONS.filter((option) => option.value !== 'all');

const parseLimit = (value: string | null) => {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(5, Math.floor(parsed)));
};

export default function FetchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);
  const step3Ref = useRef<HTMLDivElement>(null);
  const presetFromQueryRef = useRef<string | null>(null);
  const latestRunIdRef = useRef<string | null>(null);

  const [limits, setLimits] = useState<Record<Category, number>>({
    AI: 0,
    FE: 0,
    BE: 0,
    DEVOPS: 0,
    DATA: 0,
    SECURITY: 0,
    OTHER: 0
  });
  const [activeCategory, setActiveCategory] = useState<Category | 'ALL'>('AI');
  const [lookbackDays, setLookbackDays] = useState<number>(7);
  const [mode, setMode] = useState<'real' | 'dummy'>('real');
  const [locale, setLocale] = useState<'ko' | 'en' | 'all'>('ko');
  const [includeSeen, setIncludeSeen] = useState(false);
  const [htmlFallback, setHtmlFallback] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState<string>('');

  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<FetchRunStatus | null>(null);
  const [showSourceStatus, setShowSourceStatus] = useState(false);
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, FetchItemsResponse['items']>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<InboxItem | null>(null);

  const flatItems = useMemo(() => Object.values(itemsByCategory).flat(), [itemsByCategory]);
  const sortedItems = useMemo(() => {
    return [...flatItems].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [flatItems]);

  const selectedCount = selectedIds.size;
  const totalRequested = useMemo(
    () => categories.reduce((sum, category) => sum + (limits[category] ?? 0), 0),
    [limits]
  );

  const allSameCount = useMemo(() => {
    const firstCategory = categories[0];
    if (!firstCategory) return false;
    const first = limits[firstCategory];
    return categories.every((category) => limits[category] === first);
  }, [limits]);

  const allCountValue = useMemo(() => {
    const firstCategory = categories[0];
    if (!firstCategory || !allSameCount) return 0;
    return limits[firstCategory];
  }, [allSameCount, limits]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    });

  const getPreviewText = (item: InboxItem) => {
    if (item.snippet && item.snippet.trim().length > 0) return item.snippet;
    return `요약(제목 기반): ${item.title}`;
  };

  useEffect(() => {
    if (initializedRef.current) return;
    const nextLimits: Record<Category, number> = { ...limits };
    categories.forEach((category) => {
      const key = `limits${category}`;
      nextLimits[category] = parseLimit(searchParams.get(key));
    });

    const hasAnyLimit = categories.some((category) => nextLimits[category] > 0);
    if (!hasAnyLimit) {
      nextLimits.AI = 5;
      nextLimits.FE = 5;
      nextLimits.BE = 5;
      nextLimits.DEVOPS = 5;
    }

    const queryLookback = Number(searchParams.get('lookbackDays'));
    if (LOOKBACK_DAY_VALUES.includes(queryLookback)) {
      setLookbackDays(queryLookback);
    }

    const queryPreset = searchParams.get('presetId');
    if (queryPreset) {
      presetFromQueryRef.current = queryPreset;
      setPresetId(queryPreset);
    }

    setLimits(nextLimits);
    initializedRef.current = true;
  }, [searchParams, limits]);

  useEffect(() => {
    if (!initializedRef.current) return;
    const params = new URLSearchParams();
    params.set('lookbackDays', String(lookbackDays));
    if (presetId) params.set('presetId', presetId);
    categories.forEach((category) => {
      const value = limits[category];
      if (value > 0) params.set(`limits${category}`, String(value));
    });
    const queryString = params.toString();
    router.replace(queryString ? `/fetch?${queryString}` : '/fetch', { scroll: false });
  }, [lookbackDays, presetId, limits, router]);

  useEffect(() => {
    const loadPresets = async () => {
      const response = await apiFetch<{ presets: Preset[] }>('/v1/presets');
      const presetList = response.presets ?? [];
      setPresets(presetList);

      const fromQuery = presetFromQueryRef.current;
      if (fromQuery && presetList.some((preset) => preset.id === fromQuery)) {
        setPresetId(fromQuery);
        return;
      }

      const defaultPreset = presetList.find((preset) => preset.isDefault);
      if (defaultPreset) {
        setPresetId(defaultPreset.id);
      } else if (presetList.length) {
        const firstPreset = presetList[0];
        if (firstPreset) setPresetId(firstPreset.id);
      }
    };

    loadPresets().catch((error) => {
      setMessage(error instanceof Error ? error.message : '프리셋을 불러오지 못했습니다.');
    });
  }, []);

  const groupItems = (items: FetchItemsResponse['items']) => {
    const grouped: Record<string, FetchItemsResponse['items']> = {};
    for (const item of items) {
      const bucket = grouped[item.category] ?? [];
      bucket.push(item);
      grouped[item.category] = bucket;
    }
    return grouped;
  };

  const pollRun = async (runIdToPoll: string) => {
    latestRunIdRef.current = runIdToPoll;
    setPolling(true);
    try {
      for (let i = 0; i < 60; i += 1) {
        if (latestRunIdRef.current !== runIdToPoll) return;
        const status = await apiFetch<FetchRunStatus>(`/v1/fetch/run/${runIdToPoll}`);
        setRunStatus(status);
        if (status.status !== 'running') {
          if (status.status === 'success') {
            const inbox = await apiFetch<FetchItemsResponse>(
              `/v1/inbox?runId=${runIdToPoll}${includeSeen ? '&includeSeen=true' : ''}`
            );
            setItemsByCategory(groupItems(inbox.items ?? []));
          }
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setMessage('수집이 예상보다 오래 걸리고 있습니다. 잠시 후 다시 확인해주세요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '수집 상태 확인에 실패했습니다.');
    } finally {
      setPolling(false);
    }
  };

  const runFetch = async () => {
    if (totalRequested === 0) {
      setMessage('카테고리별 개수를 지정해주세요.');
      return;
    }
    if (!presetId) {
      setMessage('프리셋을 선택해주세요.');
      return;
    }
    setLoading(true);
    setMessage(null);
    setItemsByCategory({});
    setRunStatus(null);
    try {
      const body: Record<string, unknown> = {
        limits,
        mode,
        locale,
        async: true,
        lookbackDays,
        htmlFallback,
        includeSeen,
        presetId
      };

      const response = await apiFetch<{ runId: string }>('/v1/fetch/run', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      setRunId(response.runId);
      setSelectedIds(new Set());
      step3Ref.current?.scrollIntoView({ behavior: 'smooth' });
      await pollRun(response.runId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '수집에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedItems.map((item) => item.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const openPreview = (item: InboxItem) => {
    setPreviewItem(item);
  };

  const closePreview = () => {
    setPreviewItem(null);
  };

  const saveSelected = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch('/v1/posts', {
        method: 'POST',
        body: JSON.stringify({ fetchedItemIds: Array.from(selectedIds) })
      });
      setMessage('저장함에 보관했습니다.');
      setSelectedIds(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const savePreview = async () => {
    if (!previewItem) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch('/v1/posts', {
        method: 'POST',
        body: JSON.stringify({ fetchedItemIds: [previewItem.id] })
      });
      setMessage('저장함에 보관했습니다.');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(previewItem.id);
        return next;
      });
      setPreviewItem(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const summaryCounts = runStatus?.counts;
  const totalItems = flatItems.length;
  const sourceSuccess = summaryCounts?.sourceSuccess ?? 0;
  const sourceFailures = summaryCounts?.sourceFailures ?? 0;
  const sourceNotModified = summaryCounts?.sourceNotModified ?? 0;

  const emptyReasons: string[] = [];
  if (runStatus?.status === 'failed') {
    emptyReasons.push('소스가 실패했습니다.');
  } else if (totalItems === 0 && runStatus?.status === 'success') {
    emptyReasons.push('기간 내 글이 부족하거나 중복 제거로 감소했습니다.');
  }
  if (!includeSeen) {
    emptyReasons.push('이전에 본 글 제외 옵션이 영향을 줄 수 있습니다.');
  }
  if ((summaryCounts?.sourceFailures ?? 0) > 0) {
    emptyReasons.push('일부 소스가 실패했습니다.');
  }

  return (
    <div className="section">
      <h2>수집</h2>
      {message && <div className="notice">{message}</div>}

      <section className="section" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Step 1. 설정</h3>
          <span className="muted">핵심 설정만 빠르게</span>
        </div>

        <div className="input-grid" style={{ marginTop: 12 }}>
          <label>
            기간
            <select
              value={String(lookbackDays)}
              onChange={(event) => setLookbackDays(Number(event.target.value))}
            >
              {LOOKBACK_SELECT_OPTIONS.map((option) => (
                <option key={option.value} value={String(option.value)}>
                  {option.value === '1'
                    ? '당일'
                    : option.value === '7'
                      ? '1주'
                      : option.value === '30'
                        ? '1달'
                        : '6개월'}
                </option>
              ))}
            </select>
          </label>
          <label>
            프리셋 선택
            <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.sourceCount ?? 0})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="muted">카테고리별 개수</label>
          <div className="actions" style={{ marginTop: 6 }}>
            {(['ALL', ...categories] as Array<Category | 'ALL'>).map((category) => {
              const count = category === 'ALL' ? totalRequested : limits[category];
              const isActive = activeCategory === category;
              const isEnabled = count > 0;
              const style = isActive
                ? { background: 'var(--accent)', color: '#fff', border: 'none' }
                : isEnabled
                  ? { background: '#1c1b22', color: '#fff', border: 'none' }
                  : { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' };
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  style={style}
                >
                  {category === 'ALL' ? '전체' : categoryLabels[category]} · {count}개
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <select
              value={
                activeCategory === 'ALL'
                  ? allCountValue > 0
                    ? String(allCountValue)
                    : ''
                  : limits[activeCategory] > 0
                    ? String(limits[activeCategory])
                    : ''
              }
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (activeCategory === 'ALL') {
                  setLimits(() => ({
                    AI: nextValue,
                    FE: nextValue,
                    BE: nextValue,
                    DEVOPS: nextValue,
                    DATA: nextValue,
                    SECURITY: nextValue,
                    OTHER: nextValue
                  }));
                  return;
                }
                setLimits((prev) => ({
                  ...prev,
                  [activeCategory]: nextValue
                }));
              }}
            >
              <option value="" disabled>
                선택
              </option>
              {[1, 2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {count}개
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (activeCategory === 'ALL') {
                  setLimits(() => ({
                    AI: 0,
                    FE: 0,
                    BE: 0,
                    DEVOPS: 0,
                    DATA: 0,
                    SECURITY: 0,
                    OTHER: 0
                  }));
                  return;
                }
                setLimits((prev) => ({
                  ...prev,
                  [activeCategory]: 0
                }));
              }}
            >
              해제
            </button>
            <span className="muted">총 {totalRequested}개 요청</span>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button type="button" className="secondary" onClick={() => setShowAdvanced((prev) => !prev)}>
            고급 설정 {showAdvanced ? '접기' : '펼치기'}
          </button>
        </div>

        {showAdvanced && (
          <div className="actions" style={{ marginTop: 12 }}>
            <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={mode === 'real'}
                onChange={(event) => setMode(event.target.checked ? 'real' : 'dummy')}
              />
              실제 RSS로 수집
            </label>
            <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              언어
              <select value={locale} onChange={(event) => setLocale(event.target.value as 'ko' | 'en' | 'all')}>
                <option value="ko">국내</option>
                <option value="en">해외</option>
                <option value="all">전체</option>
              </select>
            </label>
            <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={includeSeen}
                onChange={(event) => setIncludeSeen(event.target.checked)}
              />
              이전에 본 글도 포함
            </label>
            <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={htmlFallback}
                onChange={(event) => setHtmlFallback(event.target.checked)}
              />
              HTML fallback 사용
            </label>
            <span className="muted" style={{ fontSize: 12 }}>
              RSS가 막히거나 비어있을 때만 도움이 됩니다.
            </span>
          </div>
        )}
      </section>

      <section className="section" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Step 2. 실행</h3>
          {runId && <span className="muted">runId: {runId}</span>}
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button type="button" onClick={runFetch} disabled={loading || polling}>
            {loading || polling ? '수집 중...' : '수집 실행'}
          </button>
        </div>
        {runStatus?.status === 'running' && (
          <div className="muted" style={{ marginTop: 8 }}>
            실행 중… sourceReports {runStatus.sources?.length ?? 0}건 수신
          </div>
        )}
        {runStatus?.status === 'failed' && (
          <div className="notice" style={{ marginTop: 8 }}>
            실행에 실패했습니다. 설정을 조정하거나 다시 실행해 주세요.
          </div>
        )}
      </section>

      <section ref={step3Ref} className="section" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Step 3. 검토 & 저장</h3>
          <div className="actions">
            <button type="button" className="secondary" onClick={selectAll} disabled={sortedItems.length === 0}>
              전체 선택
            </button>
            <button type="button" className="secondary" onClick={clearSelection} disabled={selectedCount === 0}>
              선택 해제
            </button>
            <button type="button" onClick={saveSelected} disabled={loading || selectedCount === 0}>
              선택 저장 ({selectedCount})
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div className="muted">총 결과: {totalItems}개</div>
            <div className="muted">성공: {sourceSuccess} · 실패: {sourceFailures} · 304: {sourceNotModified}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="secondary" onClick={() => setShowSourceStatus((prev) => !prev)}>
              실패 소스 보기 {showSourceStatus ? '접기' : '펼치기'}
            </button>
          </div>
        </div>

        {showSourceStatus && runStatus?.sources && runStatus.sources.length > 0 && (
          <div className="list" style={{ marginTop: 12 }}>
            {runStatus.sources.map((source) => {
              const statusLabel =
                source.status === 200 ? '성공' : source.status === 304 ? '변경 없음' : '실패';
              return (
                <div key={source.sourceId} className="card">
                  <strong>{source.name}</strong>
                  <div className="muted">
                    상태: {statusLabel} ({source.status}) · 수집: {source.fetchedCount}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {source.hostname ?? 'unknown'} · {source.latencyMs ?? '-'}ms · 도메인 동시성{' '}
                    {source.domainConcurrencyApplied ?? '-'}
                  </div>
                  {source.error && <div className="muted">오류: {source.error}</div>}
                </div>
              );
            })}
          </div>
        )}

        {sortedItems.length === 0 ? (
          <div className="card" style={{ marginTop: 12 }}>
            <strong>결과가 0개입니다.</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {emptyReasons.length > 0 ? emptyReasons.join(' / ') : '수집 결과가 없습니다.'}
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              {lookbackDays < 30 && (
                <button type="button" className="secondary" onClick={() => setLookbackDays(30)}>
                  기간 30일로 늘리기
                </button>
              )}
              {lookbackDays < 180 && (
                <button type="button" className="secondary" onClick={() => setLookbackDays(180)}>
                  기간 6개월로 늘리기
                </button>
              )}
              {!includeSeen && (
                <button type="button" className="secondary" onClick={() => setIncludeSeen(true)}>
                  이전 글 포함 켜기
                </button>
              )}
              {!htmlFallback && (
                <button type="button" className="secondary" onClick={() => setHtmlFallback(true)}>
                  HTML fallback 켜기
                </button>
              )}
              <button type="button" className="secondary" onClick={() => setShowSourceStatus(true)}>
                소스 상태 보기
              </button>
            </div>
          </div>
        ) : (
          <div className="list" style={{ marginTop: 12 }}>
            {sortedItems.map((item) => {
              const signals = item.signals ?? [];
              const visibleSignals = signals.slice(0, 3);
              const extraCount = Math.max(0, signals.length - visibleSignals.length);
              return (
                <div
                  key={item.id}
                  className="card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openPreview(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openPreview(item);
                    }
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <strong className="clamp-1">{item.title}</strong>
                        <div className="badges" style={{ justifyContent: 'flex-end' }}>
                          <span className="badge badge-date">{formatDate(item.publishedAt)}</span>
                          <span className="badge badge-source">{getDomain(item.url)}</span>
                        </div>
                      </div>
                      <div className="badges" style={{ marginTop: 6 }}>
                        {item.contentTypeHint && <span className="badge">{item.contentTypeHint}</span>}
                        {visibleSignals.map((signal) => (
                          <span key={signal} className="badge">
                            {signal}
                          </span>
                        ))}
                        {extraCount > 0 && <span className="badge">+{extraCount}</span>}
                      </div>
                      <div className="muted clamp-2" style={{ marginTop: 6 }}>
                        {getPreviewText(item)}
                      </div>
                      <div className="actions" style={{ marginTop: 8 }}>
                        <a href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                          원문
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {previewItem && (
        <div
          role="presentation"
          onClick={closePreview}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(28, 27, 34, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 50
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(720px, 100%)',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid var(--border)',
              boxShadow: '0 20px 50px rgba(28, 27, 34, 0.2)',
              padding: 20,
              display: 'grid',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>미리보기</h3>
              <button type="button" className="secondary" onClick={closePreview}>
                닫기
              </button>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{previewItem.title}</strong>
                <div className="badges" style={{ justifyContent: 'flex-end' }}>
                  <span className="badge badge-date">{formatDate(previewItem.publishedAt)}</span>
                  {previewItem.sourceName && <span className="badge badge-source">{previewItem.sourceName}</span>}
                </div>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                <a href={previewItem.url} target="_blank" rel="noreferrer">
                  {previewItem.url}
                </a>
              </div>
            </div>
            <div className="muted" style={{ maxHeight: 240, overflow: 'auto' }}>
              {getPreviewText(previewItem)}
            </div>
            <div className="badges">
              <span className="badge">
                {categoryLabels[previewItem.category as Category] ?? previewItem.category}
              </span>
              {previewItem.contentTypeHint && <span className="badge">{previewItem.contentTypeHint}</span>}
              {previewItem.signals?.map((signal) => (
                <span key={signal} className="badge">
                  {signal}
                </span>
              ))}
            </div>
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" onClick={savePreview} disabled={loading}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
