'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';

type CleanupResult = {
  dryRun: boolean;
  inboxCandidates: number;
  inboxDeleted: number;
  fetchRunCandidates: number;
  fetchRunDeleted: number;
  fetchRunSample?: { id: string; requestedAt: string; status?: string | null }[];
  inboxSample?: { id: string; publishedAt?: string | null; title?: string | null }[];
  config: {
    inboxDays: number;
    runKeep: number;
  };
  timestamp: string;
};

type ResetPreview = {
  mode: 'soft' | 'full';
  includePosts: boolean;
  counts: {
    fetchJobs: number;
    fetchRuns: number;
    fetchedItems: number;
    posts: number;
    rules: number;
    domainStats: number;
    sources: number;
    presets: number;
    presetSources: number;
  };
};

export default function SettingsPage() {
  const [preview, setPreview] = useState<CleanupResult | null>(null);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetMode, setResetMode] = useState<'soft' | 'full'>('soft');
  const [includePosts, setIncludePosts] = useState(true);
  const [resetPreview, setResetPreview] = useState<ResetPreview | null>(null);
  const [sampleDetail, setSampleDetail] = useState<{
    kind: 'fetchRun' | 'inbox';
    id: string;
    title?: string | null;
    status?: string | null;
    requestedAt?: string | null;
    publishedAt?: string | null;
  } | null>(null);

  const activeData = preview ?? result;

  const formatRelative = (timestamp?: string | null) => {
    if (!timestamp) return '-';
    const time = new Date(timestamp).getTime();
    const diff = Date.now() - time;
    if (diff < 60_000) return '방금';
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  const formatAbsolute = (timestamp?: string | null) =>
    timestamp ? new Date(timestamp).toLocaleString() : '-';

  const runPreview = async () => {
    setLoading(true);
    setBanner(null);
    try {
      const response = await apiFetch<{ ok: boolean; result: CleanupResult }>(
        '/v1/maintenance/cleanup?dryRun=true'
      );
      setPreview(response.result);
      setResult(null);
      setBanner({ type: 'info', text: '삭제 대상 미리보기를 불러왔습니다.' });
    } catch (error) {
      setBanner({ type: 'error', text: error instanceof Error ? error.message : '정리 미리보기에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const runCleanup = async () => {
    setLoading(true);
    setBanner(null);
    try {
      const response = await apiFetch<{ ok: boolean; result: CleanupResult }>(
        '/v1/maintenance/cleanup',
        { method: 'POST', body: JSON.stringify({ dryRun: false }) }
      );
      setPreview(null);
      setResult(response.result);
      setBanner({
        type: 'success',
        text: `정리 완료: Inbox ${response.result.inboxDeleted}건, FetchRun ${response.result.fetchRunDeleted}건`
      });
    } catch (error) {
      setBanner({ type: 'error', text: error instanceof Error ? error.message : '정리 실행에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const clearTurboCache = async () => {
    if (!window.confirm('Turbo 캐시(.turbo)를 삭제할까요?')) return;
    setLoading(true);
    setBanner(null);
    try {
      const response = await apiFetch<{ ok: boolean; removed?: boolean }>(
        '/v1/maintenance/turbo-clean',
        { method: 'POST' }
      );
      setBanner({
        type: 'success',
        text: response.removed ? 'Turbo 캐시를 삭제했습니다.' : '삭제할 Turbo 캐시가 없습니다.'
      });
    } catch (error) {
      setBanner({ type: 'error', text: error instanceof Error ? error.message : '캐시 삭제에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const resetDatabase = async () => {
    setLoading(true);
    setBanner(null);
    try {
      const response = await apiFetch<{
        ok: boolean;
        result: {
          mode: 'soft' | 'full';
          includePosts: boolean;
          posts: number;
          fetchedItems: number;
          fetchRuns: number;
          fetchJobs: number;
          rules: number;
          domainStats: number;
          sources: number;
          presets: number;
          presetSources: number;
        };
      }>('/v1/maintenance/db-reset', { method: 'POST', body: JSON.stringify({ mode: resetMode, includePosts }) });
      setBanner({
        type: 'success',
        text: `DB 초기화 완료: Posts ${response.result.posts}, Inbox ${response.result.fetchedItems}, FetchRun ${response.result.fetchRuns}`
      });
    } catch (error) {
      setBanner({ type: 'error', text: error instanceof Error ? error.message : 'DB 초기화에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const previewReset = async () => {
    setLoading(true);
    setBanner(null);
    try {
      const response = await apiFetch<{ ok: boolean; preview: ResetPreview }>(
        `/v1/maintenance/db-reset/preview?mode=${resetMode}&includePosts=${includePosts ? 'true' : 'false'}`
      );
      setResetPreview(response.preview);
      setBanner({ type: 'info', text: 'DB 초기화 미리보기를 불러왔습니다.' });
    } catch (error) {
      setBanner({ type: 'error', text: error instanceof Error ? error.message : '미리보기에 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <h2>관리</h2>
      <p className="muted">
        Inbox 7일 초과, FetchRun 100개 초과분을 정리합니다. 저장함(Posts)은 삭제되지 않습니다.
      </p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>데이터 정리</h3>
        <div className="cleanup-actions">
          <button type="button" onClick={runPreview} disabled={loading}>
            정리 미리보기
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setConfirmed(false);
              setShowConfirm(true);
            }}
            disabled={loading}
          >
            정리 실행
          </button>
        </div>

        {banner && <div className={`banner ${banner.type}`}>{banner.text}</div>}

        {activeData && (
          <>
            <div className="cleanup-stats">
              <div className="stat-card">
                <div className="muted">Inbox 삭제 예정</div>
                <strong>{activeData.inboxCandidates}건</strong>
                <div className="muted">기준 {activeData.config.inboxDays}일</div>
              </div>
              <div className="stat-card">
                <div className="muted">FetchRun 삭제 예정</div>
                <strong>{activeData.fetchRunCandidates}건</strong>
                <div className="muted">최근 {activeData.config.runKeep}개 유지</div>
              </div>
              <div className="stat-card highlight">
                <div className="muted">Posts 삭제</div>
                <strong>0건</strong>
                <div className="muted">Posts는 삭제하지 않음</div>
              </div>
            </div>

            <div className="muted" style={{ marginTop: 8 }}>
              기준 시각: {formatRelative(activeData.timestamp)} ({formatAbsolute(activeData.timestamp)})
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <strong>삭제 예정 샘플</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                FetchRun (오래된 순 3~5개)
              </div>
              {activeData.fetchRunSample && activeData.fetchRunSample.length > 0 ? (
                <ul className="muted" style={{ marginTop: 6, paddingLeft: 18, display: 'grid', gap: 6 }}>
                  {activeData.fetchRunSample.map((run) => (
                    <li key={run.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>
                        {run.id.slice(0, 6)} · {formatAbsolute(run.requestedAt)} · {run.status ?? '-'}
                      </span>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setSampleDetail({
                            kind: 'fetchRun',
                            id: run.id,
                            status: run.status ?? null,
                            requestedAt: run.requestedAt
                          })
                        }
                      >
                        보기
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="muted" style={{ marginTop: 6 }}>
                  삭제 예정 FetchRun 없음
                </div>
              )}

              <div className="muted" style={{ marginTop: 12 }}>
                Inbox (오래된 순 3~5개)
              </div>
              {activeData.inboxSample && activeData.inboxSample.length > 0 ? (
                <ul className="muted" style={{ marginTop: 6, paddingLeft: 18, display: 'grid', gap: 6 }}>
                  {activeData.inboxSample.map((item) => (
                    <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>
                        {item.title ?? '(제목 없음)'} · {formatAbsolute(item.publishedAt ?? null)}
                      </span>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setSampleDetail({
                            kind: 'inbox',
                            id: item.id,
                            title: item.title ?? null,
                            publishedAt: item.publishedAt ?? null
                          })
                        }
                      >
                        보기
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="muted" style={{ marginTop: 6 }}>
                  삭제 예정 Inbox 없음
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>로컬 캐시 정리</h3>
        <p className="muted" style={{ marginTop: 6 }}>
          Turbo 캐시(.turbo)를 삭제해 로컬 디스크를 정리합니다. 다음 실행은 느려질 수 있습니다.
        </p>
        <div className="actions" style={{ marginTop: 12 }}>
          <button type="button" className="secondary" onClick={clearTurboCache} disabled={loading}>
            Turbo 캐시 삭제
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>DB 초기화 (데이터 삭제)</h3>
        <p className="muted" style={{ marginTop: 6 }}>
          기본은 데이터만 삭제하며(soft), 완전 초기화(full)는 소스/프리셋까지 삭제합니다.
        </p>
        <div className="actions" style={{ marginTop: 12 }}>
          <label>
            초기화 범위
            <select value={resetMode} onChange={(event) => setResetMode(event.target.value as 'soft' | 'full')}>
              <option value="soft">데이터만 삭제</option>
              <option value="full">완전 초기화(소스/프리셋 포함)</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={includePosts}
              onChange={(event) => setIncludePosts(event.target.checked)}
            />
            Posts 포함
          </label>
          <button type="button" className="secondary" onClick={previewReset} disabled={loading}>
            미리보기
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setResetConfirmed(false);
              setShowResetConfirm(true);
            }}
            disabled={loading}
          >
            DB 초기화 실행
          </button>
        </div>
        {resetPreview && (
          <div className="card" style={{ marginTop: 12 }}>
            <strong>삭제 개수 미리보기</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              Posts 삭제: {resetPreview.includePosts ? resetPreview.counts.posts : 0}건
            </div>
            <div className="muted">Inbox 삭제: {resetPreview.counts.fetchedItems}건</div>
            <div className="muted">FetchRun 삭제: {resetPreview.counts.fetchRuns}건</div>
            <div className="muted">Rules 삭제: {resetPreview.counts.rules}건</div>
            {resetPreview.mode === 'full' && (
              <div className="muted">
                Sources 삭제: {resetPreview.counts.sources}건 · Presets 삭제: {resetPreview.counts.presets}건
              </div>
            )}
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowConfirm(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>데이터 정리 실행</h3>
              <button type="button" className="secondary" onClick={() => setShowConfirm(false)}>
                닫기
              </button>
            </div>
            <div className="notice" style={{ fontWeight: 600 }}>
              Posts는 삭제되지 않습니다.
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              Inbox 삭제 예정: {preview?.inboxCandidates ?? 0}건
            </div>
            <div className="muted">FetchRun 삭제 예정: {preview?.fetchRunCandidates ?? 0}건</div>
            <label style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              내용을 확인했습니다.
            </label>
            <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="secondary" onClick={() => setShowConfirm(false)}>
                취소
              </button>
              <button
                type="button"
                disabled={!confirmed || loading}
                onClick={() => {
                  setShowConfirm(false);
                  runCleanup();
                }}
              >
                정리 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowResetConfirm(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>DB 초기화</h3>
              <button type="button" className="secondary" onClick={() => setShowResetConfirm(false)}>
                닫기
              </button>
            </div>
            <div className="notice" style={{ fontWeight: 600 }}>
              {resetMode === 'full'
                ? '완전 초기화: 소스/프리셋까지 모두 삭제됩니다.'
                : '데이터 초기화: 소스/프리셋은 유지됩니다.'}
            </div>
            <label style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={resetConfirmed} onChange={(event) => setResetConfirmed(event.target.checked)} />
              내용을 확인했습니다.
            </label>
            <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="secondary" onClick={() => setShowResetConfirm(false)}>
                취소
              </button>
              <button
                type="button"
                disabled={!resetConfirmed || loading}
                onClick={() => {
                  setShowResetConfirm(false);
                  resetDatabase();
                }}
              >
                초기화 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {sampleDetail && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSampleDetail(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>삭제 예정 항목 상세</h3>
              <button type="button" className="secondary" onClick={() => setSampleDetail(null)}>
                닫기
              </button>
            </div>
            {sampleDetail.kind === 'fetchRun' ? (
              <div className="muted" style={{ display: 'grid', gap: 6 }}>
                <div>유형: FetchRun</div>
                <div>Run ID: {sampleDetail.id}</div>
                <div>상태: {sampleDetail.status ?? '-'}</div>
                <div>요청 시각: {formatAbsolute(sampleDetail.requestedAt ?? null)}</div>
              </div>
            ) : (
              <div className="muted" style={{ display: 'grid', gap: 6 }}>
                <div>유형: Inbox</div>
                <div>ID: {sampleDetail.id}</div>
                <div>제목: {sampleDetail.title ?? '(제목 없음)'}</div>
                <div>발행 시각: {formatAbsolute(sampleDetail.publishedAt ?? null)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
