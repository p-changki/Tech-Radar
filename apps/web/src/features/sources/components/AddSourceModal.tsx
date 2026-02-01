'use client';

import { useMemo, useState } from 'react';
import type { Category } from '@tech-radar/shared';

const steps = ['필수 정보', '고급 설정'] as const;

type NewSourceState = {
  name: string;
  key: string;
  categoryDefault: Category;
  locale: 'ko' | 'en';
  enabled: boolean;
  tags: string;
  weight: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: NewSourceState) => void;
  onDiscover: (url: string) => Promise<string[]>;
  categories: Category[];
  categoryLabels: Record<Category, string>;
};

const parseTags = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default function AddSourceModal({
  open,
  onClose,
  onCreate,
  onDiscover,
  categories,
  categoryLabels
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [discovering, setDiscovering] = useState(false);
  const [discoverMessage, setDiscoverMessage] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<string[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [form, setForm] = useState<NewSourceState>({
    name: '',
    key: '',
    categoryDefault: 'AI',
    locale: 'ko',
    enabled: true,
    tags: '',
    weight: '1.0'
  });

  const tags = useMemo(() => parseTags(form.tags), [form.tags]);
  const canContinue = form.name.trim().length > 0 && form.key.trim().length > 0;

  if (!open) return null;

  const handleDiscover = async () => {
    if (!form.key.trim()) {
      setDiscoverMessage('URL을 먼저 입력해주세요.');
      return;
    }
    setDiscovering(true);
    setDiscoverMessage(null);
    try {
      const found = await onDiscover(form.key.trim());
      setFeeds(found);
      if (found.length > 0) {
        setSelectedFeed(found[0] ?? null);
        setForm((prev) => ({ ...prev, key: found[0] ?? prev.key }));
        setDiscoverMessage(`RSS ${found.length}개를 찾았습니다.`);
      } else {
        setDiscoverMessage('RSS를 찾지 못했습니다. 직접 RSS URL을 입력해주세요.');
      }
    } catch (error) {
      setDiscoverMessage(error instanceof Error ? error.message : 'RSS 탐색에 실패했습니다.');
    } finally {
      setDiscovering(false);
    }
  };

  const handleClose = () => {
    setStepIndex(0);
    setDiscoverMessage(null);
    setFeeds([]);
    setSelectedFeed(null);
    setForm({
      name: '',
      key: '',
      categoryDefault: 'AI',
      locale: 'ko',
      enabled: true,
      tags: '',
      weight: '1.0'
    });
    onClose();
  };

  const handleSubmit = () => {
    if (!canContinue) {
      setDiscoverMessage('이름과 URL을 입력해주세요.');
      return;
    }
    onCreate(form);
    handleClose();
  };

  return (
    <div
      role="presentation"
      onClick={handleClose}
      className="modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="modal-panel"
      >
        <div className="modal-header">
          <div>
            <h3>소스 추가</h3>
            <p className="muted">{steps[stepIndex]}</p>
          </div>
          <button type="button" className="secondary" onClick={handleClose}>
            닫기
          </button>
        </div>

        {stepIndex === 0 && (
          <div className="input-grid">
            <label>
              이름
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="예: 회사 기술블로그"
              />
            </label>
            <label>
              사이트 URL 또는 RSS URL
              <input
                value={form.key}
                onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
                placeholder="https://example.com 또는 https://example.com/feed.xml"
              />
            </label>
            <label>
              RSS 찾기
              <button type="button" className="secondary" onClick={handleDiscover} disabled={discovering}>
                {discovering ? '찾는 중...' : 'RSS 찾기'}
              </button>
            </label>
            {feeds.length > 0 && (
              <div className="source-feed-list">
                {feeds.map((feed) => (
                  <button
                    key={feed}
                    type="button"
                    className={`feed-option ${selectedFeed === feed ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedFeed(feed);
                      setForm((prev) => ({ ...prev, key: feed }));
                    }}
                  >
                    {feed}
                  </button>
                ))}
              </div>
            )}
            <label>
              카테고리
              <select
                value={form.categoryDefault}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, categoryDefault: event.target.value as Category }))
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
                value={form.locale}
                onChange={(event) => setForm((prev) => ({ ...prev, locale: event.target.value as 'ko' | 'en' }))}
              >
                <option value="ko">국내</option>
                <option value="en">해외</option>
              </select>
            </label>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="input-grid">
            <label>
              활성화
              <select
                value={form.enabled ? 'true' : 'false'}
                onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.value === 'true' }))}
              >
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
            </label>
            <label>
              가중치
              <input
                value={form.weight}
                onChange={(event) => setForm((prev) => ({ ...prev, weight: event.target.value }))}
                placeholder="1.0"
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              태그 (쉼표로 구분)
              <input
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="korea, company, news"
              />
              {tags.length > 0 && (
                <div className="tag-chips">
                  {tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </label>
          </div>
        )}

        {discoverMessage && <div className="notice">{discoverMessage}</div>}

        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="secondary" onClick={handleClose}>
            취소
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIndex > 0 && (
              <button type="button" className="secondary" onClick={() => setStepIndex((prev) => prev - 1)}>
                이전
              </button>
            )}
            {stepIndex === 0 && (
              <button type="button" onClick={() => setStepIndex(1)} disabled={!canContinue}>
                다음
              </button>
            )}
            {stepIndex === 1 && (
              <button type="button" onClick={handleSubmit}>
                추가
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
