'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type PresetSummary = {
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

type PresetDetail = {
  id: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  sources: Source[];
};

export default function PresetsPage() {
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PresetDetail | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const allSelected = presets.length > 0 && selectedPresetIds.size === presets.length;
  const [showImport, setShowImport] = useState(false);
  const [importModeNew, setImportModeNew] = useState(false);
  const [importEnableSources, setImportEnableSources] = useState(false);
  const [importOverwriteMeta, setImportOverwriteMeta] = useState(false);
  const [importPresetName, setImportPresetName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [loadingImport, setLoadingImport] = useState(false);
  const [examplePreset] = useState('woowahan.json');
  const [importResult, setImportResult] = useState<{
    importedSourcesCount: number;
    reusedSourcesCount: number;
    warnings?: string[];
  } | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  const loadPresets = async () => {
    const response = await apiFetch<{ presets: PresetSummary[] }>('/v1/presets');
    setPresets(response.presets ?? []);
    setSelectedPresetIds(new Set());
  };

  const loadDetail = async (presetId: string) => {
    const response = await apiFetch<{ preset: PresetDetail }>(`/v1/presets/${presetId}`);
    setDetail(response.preset);
  };

  useEffect(() => {
    loadPresets().catch((error) => {
      setMessage(error instanceof Error ? error.message : '프리셋을 불러오지 못했습니다.');
    });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    loadDetail(selectedId).catch((error) => {
      setMessage(error instanceof Error ? error.message : '프리셋 상세를 불러오지 못했습니다.');
    });
  }, [selectedId]);

  useEffect(() => {
    if (!detail) return;
    setEditName(detail.name);
    setEditDescription(detail.description ?? '');
  }, [detail]);

  const createPreset = async () => {
    if (!name.trim()) return;
    try {
      await apiFetch('/v1/presets', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined })
      });
      setName('');
      setDescription('');
      await loadPresets();
      setMessage('새 프리셋을 만들었습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프리셋 생성에 실패했습니다.');
    }
  };

  const removeSource = async (sourceId: string) => {
    if (!detail) return;
    try {
      await apiFetch(`/v1/presets/${detail.id}/sources/${sourceId}`, {
        method: 'DELETE'
      });
      await loadDetail(detail.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '소스 제거에 실패했습니다.');
    }
  };

  const togglePresetSelection = (id: string) => {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const deleteSelectedPresets = async () => {
    if (selectedPresetIds.size === 0) return;
    setDeleting(true);
    setMessage(null);
    try {
      await apiFetch<{ deletedCount: number }>('/v1/presets', {
        method: 'DELETE',
        body: JSON.stringify({ ids: Array.from(selectedPresetIds) })
      });
      const updated = presets.filter((preset) => !selectedPresetIds.has(preset.id));
      setPresets(updated);
      setSelectedPresetIds(new Set());
    if (selectedId && selectedPresetIds.has(selectedId)) {
      setSelectedId(null);
      setDetail(null);
    }
      setMessage('선택한 프리셋을 삭제했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프리셋 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const buildImportOptions = () => ({
    mode: importModeNew ? 'new' : 'upsert',
    presetNameOverride: importPresetName.trim() || undefined,
    enableImportedSources: importEnableSources,
    overwriteSourceMeta: importOverwriteMeta
  });

  const importPresetFile = async () => {
    if (!importFile) return;
    setLoadingImport(true);
    setMessage(null);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append('file', importFile);
      form.append('options', JSON.stringify(buildImportOptions()));
      const response = await apiFetch<{
        createdOrUpdatedPresetId: string;
        importedSourcesCount: number;
        reusedSourcesCount: number;
        warnings?: string[];
      }>('/v1/presets/import', {
        method: 'POST',
        body: form
      });
      await loadPresets();
      setSelectedId(response.createdOrUpdatedPresetId);
      setImportResult({
        importedSourcesCount: response.importedSourcesCount,
        reusedSourcesCount: response.reusedSourcesCount,
        warnings: response.warnings
      });
      setShowImport(false);
      setImportFile(null);
      setMessage('프리셋을 가져왔습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '가져오기에 실패했습니다.');
    } finally {
      setLoadingImport(false);
    }
  };

  const importExample = async () => {
    setLoadingImport(true);
    setMessage(null);
    setImportResult(null);
    try {
      const response = await fetch(`/examples/presets/${examplePreset}`);
      if (!response.ok) {
        throw new Error('예제 프리셋을 불러오지 못했습니다.');
      }
      const data = await response.json();
      const result = await apiFetch<{
        createdOrUpdatedPresetId: string;
        importedSourcesCount: number;
        reusedSourcesCount: number;
        warnings?: string[];
      }>('/v1/presets/import', {
        method: 'POST',
        body: JSON.stringify({ preset: data, options: buildImportOptions() })
      });
      await loadPresets();
      setSelectedId(result.createdOrUpdatedPresetId);
      setImportResult({
        importedSourcesCount: result.importedSourcesCount,
        reusedSourcesCount: result.reusedSourcesCount,
        warnings: result.warnings
      });
      setMessage('예제 프리셋을 가져왔습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '예제 가져오기에 실패했습니다.');
    } finally {
      setLoadingImport(false);
    }
  };

  const exportPreset = async (format: 'json' | 'opml') => {
    if (!selectedId) return;
    const url = `${process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4002'}/v1/presets/${selectedId}/export?format=${format}`;
    window.open(url, '_blank');
  };

  const saveDetail = async () => {
    if (!detail) return;
    setSavingDetail(true);
    setMessage(null);
    try {
      const response = await apiFetch<{ preset: PresetDetail }>(`/v1/presets/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim() || detail.name,
          description: editDescription.trim() || ''
        })
      });
      setDetail(response.preset);
      await loadPresets();
      setMessage('프리셋 정보를 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프리셋 저장에 실패했습니다.');
    } finally {
      setSavingDetail(false);
    }
  };

  const toggleAllPresets = () => {
    if (allSelected) {
      setSelectedPresetIds(new Set());
      return;
    }
    setSelectedPresetIds(new Set(presets.map((preset) => preset.id)));
  };

  return (
    <section className="section">
      <h2>프리셋 관리</h2>
      <div className="input-grid">
        <label>
          프리셋 이름
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="예: Korea Core" />
        </label>
        <label>
          설명
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="선택 사항"
          />
        </label>
      </div>
      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" onClick={createPreset}>
          프리셋 생성
        </button>
        <button type="button" className="secondary" onClick={() => setShowImport(true)}>
          Import
        </button>
        <button type="button" className="secondary" onClick={importExample} disabled={loadingImport}>
          예제 불러오기 (Woowahan Tech)
        </button>
      </div>

      {message && <div className="notice">{message}</div>}
      {importResult && (
        <div className="notice">
          가져온 소스: {importResult.importedSourcesCount} · 재사용: {importResult.reusedSourcesCount}
          {importResult.warnings && importResult.warnings.length > 0 && (
            <div className="muted" style={{ marginTop: 4 }}>
              {importResult.warnings.join(' / ')}
            </div>
          )}
        </div>
      )}

      <div className="section" style={{ marginTop: 16 }}>
        <h2>프리셋 목록</h2>
        <div className="actions" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="secondary"
            onClick={toggleAllPresets}
            disabled={presets.length === 0}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={deleteSelectedPresets}
            disabled={deleting || selectedPresetIds.size === 0}
          >
            {deleting ? '삭제 중...' : `선택 삭제 (${selectedPresetIds.size})`}
          </button>
        </div>
        <div className="list">
          {presets.length === 0 && <div className="muted">등록된 프리셋이 없습니다.</div>}
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="card"
              style={{ textAlign: 'left', display: 'flex', gap: 10, alignItems: 'flex-start' }}
            >
              <input
                type="checkbox"
                checked={selectedPresetIds.has(preset.id)}
                onChange={() => togglePresetSelection(preset.id)}
              />
              <button
                type="button"
                style={{ textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                onClick={() => setSelectedId(preset.id)}
              >
                <strong>{preset.name}</strong>
                <div className="muted">{preset.description}</div>
                <div className="muted">
                  소스 {preset.sourceCount ?? 0}개 {preset.isDefault ? '· 기본 프리셋' : ''}
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {detail && (
        <section className="section" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{detail.name}</h2>
            <div className="actions">
              <button type="button" className="secondary" onClick={() => exportPreset('json')}>
                Export JSON
              </button>
              <button type="button" className="secondary" onClick={() => exportPreset('opml')}>
                Export OPML
              </button>
            </div>
          </div>
          <div className="muted">{detail.description}</div>
          <div className="input-grid" style={{ marginTop: 12 }}>
            <label>
              프리셋 이름
              <input value={editName} onChange={(event) => setEditName(event.target.value)} />
            </label>
            <label>
              설명
              <input value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
            </label>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={saveDetail} disabled={savingDetail}>
              {savingDetail ? '저장 중...' : '이름/설명 저장'}
            </button>
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            {(detail.sources ?? []).length === 0 && <div className="muted">추가된 소스가 없습니다.</div>}
            {(detail.sources ?? []).map((source) => (
              <div key={source.id} className="card">
                <strong>{source.name}</strong>
                <div className="muted">{source.key}</div>
                <div className="muted">
                  {source.categoryDefault} · {source.locale} · {source.enabled ? '활성' : '비활성'}
                </div>
                <button type="button" className="secondary" onClick={() => removeSource(source.id)}>
                  제거
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {showImport && (
        <div
          role="presentation"
          onClick={() => setShowImport(false)}
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
              <h3 style={{ margin: 0 }}>프리셋 Import</h3>
              <button type="button" className="secondary" onClick={() => setShowImport(false)}>
                닫기
              </button>
            </div>
            <label>
              파일 업로드 (.json/.opml)
              <input type="file" accept=".json,.opml,.xml" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
            </label>
            <label>
              새 프리셋 이름 (선택)
              <input
                value={importPresetName}
                onChange={(event) => setImportPresetName(event.target.value)}
                placeholder="비워두면 원래 이름 사용"
              />
            </label>
            <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={importModeNew}
                onChange={(event) => setImportModeNew(event.target.checked)}
              />
              새 프리셋으로 가져오기 (mode=new)
            </label>
            <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={importEnableSources}
                onChange={(event) => setImportEnableSources(event.target.checked)}
              />
              소스 활성화
            </label>
            <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={importOverwriteMeta}
                onChange={(event) => setImportOverwriteMeta(event.target.checked)}
              />
              기존 소스 메타 덮어쓰기
            </label>
            <div className="actions">
              <button type="button" onClick={importPresetFile} disabled={!importFile || loadingImport}>
                {loadingImport ? '업로드 중...' : 'Import 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
