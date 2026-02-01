'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category } from '@tech-radar/shared';
import { apiFetch } from '../../lib/api';
import { CATEGORIES, CATEGORY_LABELS } from '../../shared/constants/categories';
import FilterBar from './components/FilterBar';
import SelectionActionBar from './components/SelectionActionBar';
import SourceTable from './components/SourceTable';
import AddSourceModal from './components/AddSourceModal';
import SourceDetailDrawer from './components/SourceDetailDrawer';
import type { Preset, Source } from './types';

const categories: Category[] = [...CATEGORIES];
const categoryLabels: Record<Category, string> = CATEGORY_LABELS;

type StatusPreset = 'all' | 'enabled' | 'disabled' | 'failing' | 'throttled';

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [query, setQuery] = useState('');
  const [locale, setLocale] = useState<'ko' | 'en' | 'all'>('ko');
  const [category, setCategory] = useState<'all' | Category>('all');
  const [sortKey, setSortKey] = useState('name');
  const [statusPreset, setStatusPreset] = useState<StatusPreset>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [presetId, setPresetId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

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
    if (category !== 'all') params.set('category', category);
    if (statusPreset === 'enabled') params.set('enabled', 'true');
    if (statusPreset === 'disabled') params.set('enabled', 'false');

    const response = await apiFetch<{ sources: Source[] }>(`/v1/sources?${params.toString()}`);
    setSources(response.sources ?? []);
  }, [category, locale, query, statusPreset]);

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
  }, [loadSources]);

  const displaySources = useMemo(() => {
    let list = [...sources];
    if (statusPreset === 'failing') {
      list = list.filter((source) => (source.consecutiveFailures ?? 0) >= 3 || (source.lastStatus ?? 0) >= 500);
    }
    if (statusPreset === 'throttled') {
      list = list.filter((source) => source.lastStatus === 429 || source.lastStatus === 403);
    }
    if (sortKey === 'recent') {
      list.sort((a, b) => {
        const aTime = a.lastFetchedAt ? new Date(a.lastFetchedAt).getTime() : 0;
        const bTime = b.lastFetchedAt ? new Date(b.lastFetchedAt).getTime() : 0;
        return bTime - aTime;
      });
    } else if (sortKey === 'failures') {
      list.sort((a, b) => (b.consecutiveFailures ?? 0) - (a.consecutiveFailures ?? 0));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
    return list;
  }, [sources, sortKey, statusPreset]);

  useEffect(() => {
    setSelected((prev) => new Set(Array.from(prev).filter((id) => displaySources.some((source) => source.id === id))));
    if (selectedSource && !displaySources.some((source) => source.id === selectedSource.id)) {
      setSelectedSource(null);
      setShowDrawer(false);
    }
  }, [displaySources, selectedSource]);

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

  const toggleSelectAll = () => {
    if (selected.size === displaySources.length && displaySources.length > 0) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(displaySources.map((source) => source.id)));
  };

  const updateEnabled = async (id: string, value: boolean) => {
    try {
      await apiFetch(`/v1/sources/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: value })
      });
      setSources((prev) => prev.map((source) => (source.id === id ? { ...source, enabled: value } : source)));
      if (selectedSource?.id === id) {
        setSelectedSource((prev) => (prev ? { ...prev, enabled: value } : prev));
      }
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

  const deleteRow = async (id: string) => {
    setDeleting(true);
    setMessage(null);
    try {
      await apiFetch('/v1/sources', {
        method: 'DELETE',
        body: JSON.stringify({ ids: [id] })
      });
      setSources((prev) => prev.filter((source) => source.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setMessage('소스를 삭제했습니다.');
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

  const createSource = async (data: {
    name: string;
    key: string;
    categoryDefault: Category;
    locale: 'ko' | 'en';
    enabled: boolean;
    tags: string;
    weight: string;
  }) => {
    if (!data.name.trim() || !data.key.trim()) {
      setMessage('이름과 URL을 입력해주세요.');
      return;
    }
    try {
      const tags = data.tags
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const weightValue = Number(data.weight);
      const payload = {
        name: data.name.trim(),
        key: data.key.trim(),
        categoryDefault: data.categoryDefault,
        locale: data.locale,
        enabled: data.enabled,
        weight: Number.isFinite(weightValue) ? weightValue : undefined,
        tags: tags.length ? tags : undefined
      };
      await apiFetch('/v1/sources', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage('소스를 추가했습니다.');
      await loadSources();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '소스 추가에 실패했습니다.');
    }
  };

  const discoverFeed = async (url: string) => {
    const response = await apiFetch<{ feeds: string[] }>('/v1/sources/discover', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    return response.feeds ?? [];
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('URL을 복사했습니다.');
    } catch {
      setMessage('URL 복사에 실패했습니다.');
    }
  };

  const selectedCount = selected.size;
  const allSelected = displaySources.length > 0 && selectedCount === displaySources.length;

  return (
    <section className="section">
      <div className="sources-header">
        <div>
          <h2>소스 관리</h2>
          <p className="muted">많은 소스를 빠르게 스캔하고, 선택/비활성/프리셋 연결까지 한 번에 관리하세요.</p>
        </div>
      </div>

      <FilterBar
        query={query}
        locale={locale}
        category={category}
        sortKey={sortKey}
        statusPreset={statusPreset}
        onQueryChange={setQuery}
        onLocaleChange={setLocale}
        onCategoryChange={setCategory}
        onSortChange={setSortKey}
        onStatusPresetChange={setStatusPreset}
        categories={categories}
        categoryLabels={categoryLabels}
      />

      <SelectionActionBar
        selectedCount={selectedCount}
        allSelected={allSelected}
        presets={presets}
        presetId={presetId}
        onPresetChange={setPresetId}
        onAddToPreset={addToPreset}
        onEnableSelected={() => bulkUpdateEnabled(true)}
        onDisableSelected={() => bulkUpdateEnabled(false)}
        onDeleteSelected={deleteSelected}
        onToggleSelectAll={toggleSelectAll}
        onOpenAddModal={() => setShowAddModal(true)}
        deleting={deleting}
        disableBulk={displaySources.length === 0}
      />

      {message && <div className="notice">{message}</div>}

      <div className="sources-layout">
        <SourceTable
          sources={displaySources}
          selected={selected}
          categoryLabels={categoryLabels}
          onToggleSelect={toggleSelected}
          onToggleEnabled={updateEnabled}
          onSelectRow={(source) => {
            setSelectedSource(source);
            setShowDrawer(true);
          }}
          onDeleteRow={deleteRow}
          onCopyUrl={handleCopyUrl}
        />
      </div>

      <SourceDetailDrawer
        source={selectedSource}
        open={showDrawer}
        categoryLabels={categoryLabels}
        onClose={() => setShowDrawer(false)}
        onToggleEnabled={updateEnabled}
      />

      <AddSourceModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={createSource}
        onDiscover={discoverFeed}
        categories={categories}
        categoryLabels={categoryLabels}
      />
    </section>
  );
}
