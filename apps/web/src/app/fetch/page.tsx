'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '@tech-radar/shared';
import { apiFetch } from '../../lib/api';

const categories: Category[] = ['AI', 'FE', 'BE', 'DEVOPS', 'DATA', 'SECURITY', 'OTHER'];
const categoryLabels: Record<Category, string> = {
  AI: 'AI',
  FE: 'FE',
  BE: 'BE',
  DEVOPS: 'DEVOPS',
  DATA: '데이터',
  SECURITY: '보안',
  OTHER: '기타'
};

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

type Source = {
  id: string;
  name: string;
  key: string;
  categoryDefault: string;
  locale: string;
  enabled: boolean;
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

export default function FetchPage() {
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
  const [usePreset, setUsePreset] = useState(true);
  const [includeSeen, setIncludeSeen] = useState(false);
  const [htmlFallback, setHtmlFallback] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState<string>('');
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceQuery, setSourceQuery] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<FetchRunStatus | null>(null);
  const [showSourceStatus, setShowSourceStatus] = useState(false);
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, FetchItemsResponse['items']>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<InboxItem | null>(null);
  const latestRunIdRef = useRef<string | null>(null);

  const selectedCount = selectedIds.size;
  const flatItems = useMemo(() => Object.values(itemsByCategory).flat(), [itemsByCategory]);
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    });
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

  useEffect(() => {
    const loadPresets = async () => {
      const response = await apiFetch<{ presets: Preset[] }>('/v1/presets');
      const presetList = response.presets ?? [];
      setPresets(presetList);
      const defaultPreset = presetList.find((preset) => preset.isDefault);
      if (defaultPreset) {
        setPresetId(defaultPreset.id);
      } else if (presetList.length) {
        const firstPreset = presetList[0];
        if (firstPreset) {
          setPresetId(firstPreset.id);
        }
      }
    };

    loadPresets().catch((error) => {
      setMessage(error instanceof Error ? error.message : '프리셋을 불러오지 못했습니다.');
    });
  }, []);

  useEffect(() => {
    if (usePreset) return;

    const timer = setTimeout(() => {
      const query = new URLSearchParams();
      if (sourceQuery) query.set('q', sourceQuery);
      if (locale) query.set('locale', locale);
      apiFetch<{ sources: Source[] }>(`/v1/sources?${query.toString()}`)
        .then((response) => setSources(response.sources ?? []))
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : '소스를 불러오지 못했습니다.');
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [usePreset, sourceQuery, locale]);

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
      setMessage('카테고리를 선택하고 개수를 지정해주세요.');
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
        includeSeen
      };

      if (usePreset) {
        body.presetId = presetId || undefined;
      } else {
        body.sourceIds = Array.from(selectedSourceIds).slice(0, 50);
      }

      const response = await apiFetch<{ runId: string }>('/v1/fetch/run', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      setRunId(response.runId);
      setSelectedIds(new Set());
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

  const openPreview = (item: InboxItem) => {
    setPreviewItem(item);
  };

  const closePreview = () => {
    setPreviewItem(null);
  };

  const toggleSourceSelection = (id: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 50) {
        next.add(id);
      } else {
        setMessage('한 번에 최대 50개 소스만 선택할 수 있습니다.');
      }
      return next;
    });
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

  return (
    <div className="section">
      <h2>크롤링</h2>
      <div className="input-grid">
        <label>
          카테고리 선택
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
        </label>
        <label>
          {activeCategory === 'ALL' ? '전체' : activeCategory} 개수
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
          </div>
        </label>
      </div>

      <div className="actions" style={{ marginTop: 16 }}>
        <button type="button" onClick={runFetch} disabled={loading || polling}>
          {loading || polling ? '수집 중...' : '수집 실행'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={saveSelected}
          disabled={loading || polling || selectedCount === 0}
        >
          선택 저장 ({selectedCount})
        </button>
      </div>

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
          <input type="checkbox" checked={usePreset} onChange={(event) => setUsePreset(event.target.checked)} />
          프리셋 사용
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
        <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          기간
          <select
            value={String(lookbackDays)}
            onChange={(event) => setLookbackDays(Number(event.target.value))}
          >
            <option value="1">당일</option>
            <option value="7">일주일</option>
            <option value="30">한달</option>
            <option value="180">6개월</option>
          </select>
        </label>
      </div>

      {usePreset ? (
        <div className="input-grid" style={{ marginTop: 12 }}>
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
      ) : (
        <div className="section" style={{ marginTop: 12 }}>
          <h2>소스 직접 선택</h2>
          <div className="input-grid">
            <label>
              검색
              <input
                value={sourceQuery}
                onChange={(event) => setSourceQuery(event.target.value)}
                placeholder="키워드 또는 URL"
              />
            </label>
            <label>
              선택된 소스
              <div className="muted" style={{ paddingTop: 10 }}>
                {selectedSourceIds.size} / 50
              </div>
            </label>
          </div>
          <div className="list" style={{ marginTop: 12, maxHeight: 320, overflow: 'auto' }}>
            {sources.length === 0 && <div className="muted">표시할 소스가 없습니다.</div>}
            {sources.map((source) => (
              <label key={source.id} className="card">
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={selectedSourceIds.has(source.id)}
                    onChange={() => toggleSourceSelection(source.id)}
                  />
                  <div>
                    <strong>{source.name}</strong>
                    <div className="muted">{source.key}</div>
                    <div className="muted">
                      {source.categoryDefault} · {source.locale} · {source.enabled ? '활성' : '비활성'}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {runId && <p className="muted">실행 ID: {runId}</p>}
      {message && <div className="notice">{message}</div>}
      {runStatus?.status === 'failed' && (
        <div className="notice">수집에 실패했습니다. 소스 상태를 확인해주세요.</div>
      )}
      {runStatus?.error && <div className="notice">에러: {runStatus.error}</div>}

      {runStatus?.sources && runStatus.sources.length > 0 && (
        <section className="section" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>소스 상태</h2>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowSourceStatus((prev) => !prev)}
            >
              {showSourceStatus ? '접기' : '펼치기'}
            </button>
          </div>
          {showSourceStatus && (
            <div className="list" style={{ marginTop: 12 }}>
              {runStatus.sources.map((source) => {
                const statusLabel =
                  source.status === 200
                    ? '성공'
                    : source.status === 304
                      ? '변경 없음'
                      : '실패';
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
        </section>
      )}

      <div className="list" style={{ marginTop: 20 }}>
        {flatItems.length === 0 && <div className="muted">아직 아이템이 없습니다.</div>}
        {categories.map((category) => {
          const items = itemsByCategory[category] ?? [];
          if (items.length === 0) return null;
          return (
            <section key={category} className="section" style={{ marginBottom: 16 }}>
              <h2>{category}</h2>
              <div className="list">
                {items.map((item) => (
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
                          <strong className="clamp-2">{item.title}</strong>
                          <div className="badges" style={{ justifyContent: 'flex-end' }}>
                            <span className="badge badge-date">{formatDate(item.publishedAt)}</span>
                            {item.sourceName && <span className="badge badge-source">{item.sourceName}</span>}
                          </div>
                        </div>
                        <div className="muted">{item.url}</div>
                        {item.snippet && <div className="muted clamp-3">{item.snippet}</div>}
                        {item.contentTypeHint && (
                          <div className="badges">
                            <span className="badge">{item.contentTypeHint}</span>
                          </div>
                        )}
                        {item.signals?.length ? (
                          <div className="badges">
                            {item.signals.map((signal) => (
                              <span key={signal} className="badge">
                                {signal}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

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
            {previewItem.snippet && (
              <div className="muted" style={{ maxHeight: 240, overflow: 'auto' }}>
                {previewItem.snippet}
              </div>
            )}
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
              <button
                type="button"
                className="secondary"
                onClick={() => toggleSelection(previewItem.id)}
              >
                {selectedIds.has(previewItem.id) ? '선택 해제' : '선택하기'}
              </button>
              <button type="button" onClick={saveSelected} disabled={selectedIds.size === 0}>
                선택 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
