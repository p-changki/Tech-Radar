'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

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

type Props = {
  posts: Post[];
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  highlightParts: (text: string) => string[];
  categoryLabels: Record<string, string>;
};

export default function PostList({ posts, selectedIds, toggleSelection, highlightParts, categoryLabels }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 190,
    overscan: 8
  });

  if (posts.length === 0) {
    return <div className="muted">저장된 항목이 없습니다.</div>;
  }

  return (
    <div
      ref={parentRef}
      className="list"
      style={{ marginTop: 12, maxHeight: '70vh', overflow: 'auto', position: 'relative' }}
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((row) => {
          const post = posts[row.index];
          if (!post) return null;
          return (
            <div
              key={post.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${row.start}px)`
              }}
            >
              <article className="card compact">
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(post.id)}
                    onChange={() => toggleSelection(post.id)}
                  />
                  <div>
                    <a href={`/posts/${post.id}`}>
                      <strong>
                        {highlightParts(post.title).map((part, index) =>
                          index % 2 === 1 ? (
                            <mark key={`${part}-${index}`} className="highlight">
                              {part}
                            </mark>
                          ) : (
                            <span key={`${part}-${index}`}>{part}</span>
                          )
                        )}
                      </strong>
                    </a>
                    <div className="muted clamp-1">
                      {highlightParts(post.url).map((part, index) =>
                        index % 2 === 1 ? (
                          <mark key={`${part}-${index}`} className="highlight">
                            {part}
                          </mark>
                        ) : (
                          <span key={`${part}-${index}`}>{part}</span>
                        )
                      )}
                    </div>
                    <div className="muted">{new Date(post.publishedAt).toLocaleString()}</div>
                    <div className="badges">
                      <span className="badge">{categoryLabels[post.category] ?? post.category}</span>
                      {post.contentType && <span className="badge">{post.contentType}</span>}
                      {post.signals?.map((signal) => (
                        <span key={signal} className="badge">
                          {signal}
                        </span>
                      ))}
                    </div>
                    <div className="summary">
                      {post.summaryPoints && post.summaryPoints.length > 0 ? (
                        <ul className="muted" style={{ margin: '6px 0 0 18px' }}>
                          {post.summaryPoints.slice(0, 3).map((point, index) => (
                            <li key={`${post.id}-point-${index}`}>
                              {highlightParts(point).map((part, partIndex) =>
                                partIndex % 2 === 1 ? (
                                  <mark key={`${part}-${partIndex}`} className="highlight">
                                    {part}
                                  </mark>
                                ) : (
                                  <span key={`${part}-${partIndex}`}>{part}</span>
                                )
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted clamp-2">
                          {highlightParts(post.summaryTldr).map((part, index) =>
                            index % 2 === 1 ? (
                              <mark key={`${part}-${index}`} className="highlight">
                                {part}
                              </mark>
                            ) : (
                              <span key={`${part}-${index}`}>{part}</span>
                            )
                          )}
                        </p>
                      )}
                    </div>
                    <div className="actions" style={{ marginTop: 6 }}>
                      <a
                        href={`/posts/${post.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 999,
                          background: 'var(--accent)',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        자세히 보기
                        <span aria-hidden="true">→</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}
