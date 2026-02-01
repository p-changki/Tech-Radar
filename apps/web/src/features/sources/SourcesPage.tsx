'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

type Source = {
  id: string;
  name: string;
  key: string;
  categoryDefault: Category;
  locale: string;
  enabled: boolean;
  tags?: string[];
  consecutiveFailures?: number;
  lastError?: string | null;
  lastStatus?: number | null;
  lastFetchedAt?: string | null;
};

type Preset = {
  id: string;
  name: string;
  sourceCount?: number;
  isDefault?: boolean;
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [query, setQuery] = useState('');
  const [locale, setLocale] = useState<'ko' | 'en' | 'all'>('ko');
  const [enabled, setEnabled] = useState<'all' | 'true' | 'false'>('all');
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [category, setCategory] = useState<'all' | Category>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [presetId, setPresetId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoverMessage, setDiscoverMessage] = useState<string | null>(null);
  const [discoveredFeeds, setDiscoveredFeeds] = useState<string[]>([]);
  const [newSource, setNewSource] = useState({
    name: '',
    key: '',
    categoryDefault: 'AI' as Category,
    locale: 'ko' as 'ko' | 'en',
    enabled: true,
    tags: '',
    weight: '1.0'
  });

  const selectedCount = selected.size;

  const toggleSelectAll = () => {
    if (selected.size === sources.length && sources.length > 0) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(sources.map((source) => source.id)));
  };

  const loadPresets = useCallback(async () => {
    const response = await apiFetch<{ presets: Preset[] }>('/v1/presets');
    const presetList = response.presets ?? [];
    setPresets(presetList);
    setPresetId((prev) => {
      if (prev) return prev;
      const firstPreset = presetList[0];
      return firstPreset ? firstPreset.id : '';
    });
  }, []);

  const loadSources = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (locale) params.set('locale', locale);
    if (enabled !== 'all') {
      params.set('enabled', enabled);
    } else if (showInactiveOnly) {
      params.set('enabled', 'false');
    }
    if (category !== 'all') params.set('category', category);

    const response = await apiFetch<{ sources: Source[] }>(`/v1/sources?${params.toString()}`);
    setSources(response.sources ?? []);
  }, [category, enabled, locale, query, showInactiveOnly]);

  useEffect(() => {
    loadPresets().catch((error) => {
      setMessage(error instanceof Error ? error.message : '프리셋을 불러오지 못했습니다.');
    });
  }, [loadPresets]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSources().catch((error) => {
        setMessage(error instanceof Error ? error.message : '소스를 불러오지 못했습니다.');
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [loadSources, showInactiveOnly]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateEnabled = async (id: string, value: boolean) => {
    try {
      await apiFetch(`/v1/sources/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: value })
      });
      setSources((prev) => prev.map((source) => (source.id === id ? { ...source, enabled: value } : source)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '소스 업데이트에 실패했습니다.');
    }
  };

  const bulkUpdateEnabled = async (value: boolean) => {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          apiFetch(`/v1/sources/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ enabled: value })
          })
        )
      );
      setSources((prev) =>
        prev.map((source) => (selected.has(source.id) ? { ...source, enabled: value } : source))
      );
      setMessage(value ? '선택한 소스를 활성화했습니다.' : '선택한 소스를 비활성화했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '일괄 업데이트에 실패했습니다.');
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    setMessage(null);
    try {
      await apiFetch('/v1/sources', {
        method: 'DELETE',
        body: JSON.stringify({ ids: Array.from(selected) })
      });
      setSources((prev) => prev.filter((source) => !selected.has(source.id)));
      setSelected(new Set());
      setMessage('선택한 소스를 삭제했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '소스 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const addToPreset = async () => {
    if (!presetId || selected.size === 0) return;
    try {
      await apiFetch(`/v1/presets/${presetId}/sources`, {
        method: 'POST',
        body: JSON.stringify({ sourceIds: Array.from(selected) })
      });
      setMessage('프리셋에 소스를 추가했습니다.');
      setSelected(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프리셋 추가에 실패했습니다.');
    }
  };

  const resetNewSource = () => {
    setNewSource({
      name: '',
      key: '',
      categoryDefault: 'AI',
      locale: 'ko',
      enabled: true,
      tags: '',
      weight: '1.0'
    });
    setDiscoveredFeeds([]);
    setDiscoverMessage(null);
  };

  const createSource = async () => {
    if (!newSource.name.trim() || !newSource.key.trim()) {
      setMessage('이름과 URL을 입력해주세요.');
      return;
    }
    try {
      const tags = newSource.tags
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const weightValue = Number(newSource.weight);
      const payload = {
        name: newSource.name.trim(),
        key: newSource.key.trim(),
        categoryDefault: newSource.categoryDefault,
        locale: newSource.locale,
        enabled: newSource.enabled,
        weight: Number.isFinite(weightValue) ? weightValue : undefined,
        tags: tags.length ? tags : undefined
      };
      await apiFetch('/v1/sources', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage('소스를 추가했습니다.');
      setShowAddModal(false);
      resetNewSource();
      await loadSources();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '소스 추가에 실패했습니다.');
    }
  };

  const discoverFeed = async () => {
    if (!newSource.key.trim()) {
      setDiscoverMessage('URL을 먼저 입력해주세요.');
      return;
    }
    setDiscovering(true);
    setDiscoverMessage(null);
    try {
      const response = await apiFetch<{ feeds: string[] }>('/v1/sources/discover', {
        method: 'POST',
        body: JSON.stringify({ url: newSource.key.trim() })
      });
      const feeds = response.feeds ?? [];
      setDiscoveredFeeds(feeds);
      if (feeds.length > 0) {
        setNewSource((prev) => ({ ...prev, key: feeds[0] ?? prev.key }));
        setDiscoverMessage(`RSS ${feeds.length}개를 찾았습니다.`);
      } else {
        setDiscoverMessage('RSS를 찾지 못했습니다. 직접 RSS URL을 입력해주세요.');
      }
    } catch (error) {
      setDiscoverMessage(error instanceof Error ? error.message : 'RSS 탐색에 실패했습니다.');
    } finally {
      setDiscovering(false);
    }
  };

  const selectedLabel = useMemo(() => {
    const preset = presets.find((item) => item.id === presetId);
    return preset ? preset.name : '프리셋 선택';
  }, [presetId, presets]);

  return (
    <section className="section">
      <h2>소스 관리</h2>
      <div className="input-grid">
        <label>
          검색
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 URL" />
        </label>
        <label>
          언어
          <select value={locale} onChange={(event) => setLocale(event.target.value as 'ko' | 'en' | 'all')}>
            <option value="ko">국내</option>
            <option value="en">해외</option>
            <option value="all">전체</option>
          </select>
        </label>
        <label>
          활성화
          <select value={enabled} onChange={(event) => setEnabled(event.target.value as 'all' | 'true' | 'false')}>
            <option value="all">전체</option>
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>
        </label>
        <label>
          빠른 보기
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setEnabled('all');
              setShowInactiveOnly((prev) => !prev);
            }}
          >
            {showInactiveOnly ? '전체 보기' : '비활성만 보기'}
          </button>
        </label>
        <label>
          카테고리
          <select value={category} onChange={(event) => setCategory(event.target.value as 'all' | Category)}>
            <option value="all">전체</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {categoryLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="secondary" onClick={toggleSelectAll} disabled={sources.length === 0}>
          {selected.size === sources.length && sources.length > 0 ? '전체 해제' : '전체 선택'}
        </button>
        <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          프리셋
          <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
            <option value="">{selectedLabel}</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} ({preset.sourceCount ?? 0})
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={addToPreset} disabled={!presetId || selectedCount === 0}>
          프리셋에 추가 ({selectedCount})
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => bulkUpdateEnabled(true)}
          disabled={selectedCount === 0}
        >
          선택 활성화
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => bulkUpdateEnabled(false)}
          disabled={selectedCount === 0}
        >
          선택 비활성화
        </button>
        <button
          type="button"
          className="secondary"
          onClick={deleteSelected}
          disabled={selectedCount === 0 || deleting}
        >
          {deleting ? '삭제 중...' : `선택 삭제 (${selectedCount})`}
        </button>
        <button type="button" className="secondary" onClick={() => setShowAddModal(true)}>
          소스 추가
        </button>
      </div>

      {message && <div className="notice">{message}</div>}

      <div className="list" style={{ marginTop: 16 }}>
        {sources.length === 0 && <div className="muted">조건에 맞는 소스가 없습니다.</div>}
        {sources.map((source) => {
          const failureCount = source.consecutiveFailures ?? 0;
          const autoDisabled = !source.enabled && failureCount >= 5;
          return (
            <div key={source.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(source.id)}
                    onChange={() => toggleSelected(source.id)}
                  />
                  <div>
                    <strong>{source.name}</strong>
                    <div className="muted">{source.key}</div>
                    <div className="muted">
                      {categoryLabels[source.categoryDefault]} · {source.locale}
                    </div>
                    <div className="badges" style={{ marginTop: 6 }}>
                      <span className={`badge ${source.enabled ? 'badge-active' : 'badge-inactive'}`}>
                        {source.enabled ? '활성' : '비활성'}
                      </span>
                      {failureCount > 0 && (
                        <span className={`badge ${autoDisabled ? 'badge-danger' : 'badge-warning'}`}>
                          최근 실패 {failureCount}
                        </span>
                      )}
                      {autoDisabled && <span className="badge badge-danger">자동 비활성</span>}
                    </div>
                    {source.lastError && (
                      <div className="muted clamp-1" style={{ marginTop: 4 }}>
                        최근 오류: {source.lastError}
                      </div>
                    )}
                  </div>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={source.enabled}
                      onChange={(event) => updateEnabled(source.id, event.target.checked)}
                    />
                    <span className="toggle-track">
                      <span className="toggle-thumb" />
                    </span>
                    <span>{source.enabled ? '활성화됨' : '비활성'}</span>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div
          role="presentation"
          onClick={() => setShowAddModal(false)}
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
              width: 'min(640px, 100%)',
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
              <h3 style={{ margin: 0 }}>소스 추가</h3>
              <button type="button" className="secondary" onClick={() => setShowAddModal(false)}>
                닫기
              </button>
            </div>
            <div className="input-grid">
              <label>
                이름
                <input
                  value={newSource.name}
                  onChange={(event) => setNewSource((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="예: 회사 기술블로그"
                />
              </label>
              <label>
                RSS URL
                <input
                  value={newSource.key}
                  onChange={(event) => setNewSource((prev) => ({ ...prev, key: event.target.value }))}
                  placeholder="https://example.com/feed.xml"
                />
              </label>
              <label>
                RSS 탐색
                <button type="button" className="secondary" onClick={discoverFeed} disabled={discovering}>
                  {discovering ? '찾는 중...' : 'RSS 찾기'}
                </button>
              </label>
              {discoveredFeeds.length > 1 && (
                <label>
                  찾은 RSS
                  <select
                    value={newSource.key}
                    onChange={(event) => setNewSource((prev) => ({ ...prev, key: event.target.value }))}
                  >
                    {discoveredFeeds.map((feed) => (
                      <option key={feed} value={feed}>
                        {feed}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                카테고리
                <select
                  value={newSource.categoryDefault}
                  onChange={(event) =>
                    setNewSource((prev) => ({ ...prev, categoryDefault: event.target.value as Category }))
                  }
                >
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                언어
                <select
                  value={newSource.locale}
                  onChange={(event) => setNewSource((prev) => ({ ...prev, locale: event.target.value as 'ko' | 'en' }))}
                >
                  <option value="ko">국내</option>
                  <option value="en">해외</option>
                </select>
              </label>
              <label>
                활성화
                <select
                  value={newSource.enabled ? 'true' : 'false'}
                  onChange={(event) =>
                    setNewSource((prev) => ({ ...prev, enabled: event.target.value === 'true' }))
                  }
                >
                  <option value="true">활성</option>
                  <option value="false">비활성</option>
                </select>
              </label>
              <label>
                가중치
                <input
                  value={newSource.weight}
                  onChange={(event) => setNewSource((prev) => ({ ...prev, weight: event.target.value }))}
                  placeholder="1.0"
                />
              </label>
              <label>
                태그 (쉼표로 구분)
                <input
                  value={newSource.tags}
                  onChange={(event) => setNewSource((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="korea, company, news"
                />
              </label>
            </div>
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  resetNewSource();
                  setShowAddModal(false);
                }}
              >
                취소
              </button>
              <button type="button" onClick={createSource}>
                추가
              </button>
            </div>
            {discoverMessage && <div className="notice">{discoverMessage}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
