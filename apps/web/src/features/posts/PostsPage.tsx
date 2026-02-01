'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import PostList from './components/PostList';

const CATEGORIES = ['AI', 'FE', 'BE', 'DEVOPS', 'DATA', 'SECURITY', 'OTHER'] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  AI: 'AI',
  FE: 'FE',
  BE: 'BE',
  DEVOPS: 'DEVOPS',
  DATA: '데이터',
  SECURITY: '보안',
  OTHER: '기타'
};
const CONTENT_TYPES = ['RELEASE_NOTE', 'COMPANY_BLOG', 'NEWS', 'OTHER'] as const;
const SIGNALS = ['security', 'breaking', 'deprecation', 'release', 'perf', 'migration', 'bugfix', 'tooling', 'api'] as const;

type Post = {
  id: string;
  title: string;
  url: string;
  category: string;
  publishedAt: string;
  savedAt?: string;
  summaryTldr: string;
  summaryPoints?: string[];
  signals: string[];
  contentType?: string | null;
  tags?: string[];
};

type PostsResponse = { posts: Post[] };

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [categoryFilter, setCategoryFilter] = useState<'all' | (typeof CATEGORIES)[number]>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | (typeof CONTENT_TYPES)[number]>('all');
  const [signalFilter, setSignalFilter] = useState<'all' | (typeof SIGNALS)[number]>('all');

  const highlightParts = (text: string) => {
    const keyword = query.trim();
    if (!keyword) return [text];
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'ig');
    return text.split(regex);
  };

  const filteredPosts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const next = posts.filter((post) => {
      if (categoryFilter !== 'all' && post.category !== categoryFilter) return false;
      if (contentTypeFilter !== 'all' && post.contentType !== contentTypeFilter) return false;
      if (signalFilter !== 'all' && !(post.signals ?? []).includes(signalFilter)) return false;
      if (!keyword) return true;
      const inTitle = post.title?.toLowerCase().includes(keyword);
      const inUrl = post.url?.toLowerCase().includes(keyword);
      const inSummary = post.summaryTldr?.toLowerCase().includes(keyword);
      const inPoints = (post.summaryPoints ?? []).some((point) => point.toLowerCase().includes(keyword));
      const inTags = (post.tags ?? []).some((tag) => tag.toLowerCase().includes(keyword));
      return Boolean(inTitle || inUrl || inSummary || inPoints || inTags);
    });

    return next.sort((a, b) => {
      const left = new Date(a.savedAt ?? a.publishedAt).getTime();
      const right = new Date(b.savedAt ?? b.publishedAt).getTime();
      return sortOrder === 'desc' ? right - left : left - right;
    });
  }, [posts, query, sortOrder, categoryFilter, contentTypeFilter, signalFilter]);

  const allSelected = filteredPosts.length > 0 && filteredPosts.every((post) => selectedIds.has(post.id));

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiFetch<PostsResponse>('/v1/posts');
        setPosts(response.posts ?? []);
        setSelectedIds(new Set());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '저장된 항목을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    setMessage(null);
    try {
      await apiFetch<{ deletedCount: number }>('/v1/posts', {
        method: 'DELETE',
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      setPosts((prev) => prev.filter((post) => !selectedIds.has(post.id)));
      setSelectedIds(new Set());
      setMessage('선택한 항목을 삭제했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredPosts.forEach((post) => next.delete(post.id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredPosts.forEach((post) => next.add(post.id));
      return next;
    });
  };


  return (
    <section className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>저장된 항목</h2>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={toggleAll}
            disabled={loading || posts.length === 0}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={deleteSelected}
            disabled={deleting || selectedIds.size === 0}
          >
            {deleting ? '삭제 중...' : `선택 삭제 (${selectedIds.size})`}
          </button>
        </div>
      </div>
      {loading && <div className="muted">불러오는 중...</div>}
      {message && <div className="notice">{message}</div>}
      <div className="input-grid" style={{ marginTop: 12 }}>
        <label>
          검색
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목, 요약, URL, 태그"
          />
        </label>
        <label>
          정렬
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}>
            <option value="desc">최신순</option>
            <option value="asc">오래된순</option>
          </select>
        </label>
        <label>
          카테고리
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as 'all' | (typeof CATEGORIES)[number])}
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
            value={contentTypeFilter}
            onChange={(event) =>
              setContentTypeFilter(event.target.value as 'all' | (typeof CONTENT_TYPES)[number])
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
            value={signalFilter}
            onChange={(event) => setSignalFilter(event.target.value as 'all' | (typeof SIGNALS)[number])}
          >
            <option value="all">전체</option>
            {SIGNALS.map((signal) => (
              <option key={signal} value={signal}>
                {signal}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!loading && (
        <PostList
          posts={filteredPosts}
          selectedIds={selectedIds}
          toggleSelection={toggleSelection}
          highlightParts={highlightParts}
          categoryLabels={CATEGORY_LABELS}
        />
      )}
    </section>
  );
}
