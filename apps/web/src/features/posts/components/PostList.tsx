'use client';

import { useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getDomain } from '../../../shared/lib/url';
import { PostBadges } from '../../../entities/post';

type Post = {
  id: string;
  title: string;
  url: string;
  category: string;
  publishedAt: string;
  savedAt?: string;
  summaryTldr: string;
  signals: string[];
  contentType?: string | null;
  status?: string | null;
  collection?: string | null;
  pinned?: boolean | null;
};

type Props = {
  posts: Post[];
  selectedIds: Set<string>;
  selectedPostId: string | null;
  onToggleSelect: (id: string) => void;
  onSelectPost: (id: string) => void;
  highlightParts: (text: string) => string[];
  onEndReached?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
};

export default function PostList({
  posts,
  selectedIds,
  selectedPostId,
  onToggleSelect,
  onSelectPost,
  highlightParts,
  onEndReached,
  hasMore,
  loadingMore
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    measureElement: (el) => (el ? el.getBoundingClientRect().height : 180),
    overscan: 8
  });

  const handleScroll = useCallback(() => {
    if (!parentRef.current || !hasMore || loadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    if (scrollHeight - scrollTop - clientHeight < 220) {
      onEndReached?.();
    }
  }, [hasMore, loadingMore, onEndReached]);

  if (posts.length === 0) {
    return <div className="muted">저장된 항목이 없습니다.</div>;
  }

  return (
    <div
      ref={parentRef}
      className="posts-list"
      style={{ marginTop: 8 }}
      onScroll={handleScroll}
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((row) => {
          const post = posts[row.index];
          if (!post) return null;
          const isActive = selectedPostId === post.id;
          const isPinned = Boolean(post.pinned);
          const domain = getDomain(post.url);
          const dateLabel = new Date(post.savedAt ?? post.publishedAt).toLocaleDateString();
          return (
            <div
              key={post.id}
              ref={rowVirtualizer.measureElement}
              data-index={row.index}
              className="post-row-wrap"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${row.start}px)`
              }}
            >
              <article
                className={`post-row ${isActive ? 'active' : ''}`}
                onClick={() => onSelectPost(post.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(post.id)}
                  onChange={() => onToggleSelect(post.id)}
                  onClick={(event) => event.stopPropagation()}
                />
                <div className="post-row-main">
                  <div className="post-row-top">
                    <strong className="clamp-2 post-row-title" title={post.title}>
                      {isPinned && <span style={{ marginRight: 6 }}>⭐</span>}
                      {highlightParts(post.title).map((part, index) =>
                        index % 2 === 1 ? (
                          <mark key={`${post.id}-title-${index}`} className="highlight">
                            {part}
                          </mark>
                        ) : (
                          <span key={`${post.id}-title-${index}`}>{part}</span>
                        )
                      )}
                    </strong>
                    <div className="post-row-meta">
                      <span className="meta-pill">{domain}</span>
                      <span className="meta-pill">{dateLabel}</span>
                    </div>
                  </div>
                  <div className="post-row-badges badges">
                    <PostBadges
                      category={post.category}
                      status={post.status}
                      collection={post.collection}
                      pinned={post.pinned}
                      contentType={post.contentType}
                      signals={post.signals ?? []}
                    />
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>
      {loadingMore && <div className="muted" style={{ padding: 12 }}>추가 불러오는 중...</div>}
    </div>
  );
}
