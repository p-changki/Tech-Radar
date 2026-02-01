import { memo, type ReactNode } from 'react';
import type { Post } from '../../../entities/post';
import { getDomain } from '../../../shared/lib/url';
import { PostBadges } from '../../../entities/post';

type Props = {
  post: Post | null;
  onDelete: (id: string) => void;
  deleting: boolean;
  children?: ReactNode;
};

function PostDetail({ post, onDelete, deleting, children }: Props) {
  if (!post) {
    return <div className="posts-detail">선택된 항목이 없습니다.</div>;
  }

  const meta = (post.summaryMeta ?? {}) as Record<string, unknown>;
  const keywords = Array.isArray(meta.keywords) ? (meta.keywords as string[]).join(', ') : '-';
  const takeaways = Array.isArray(meta.takeaways) ? (meta.takeaways as string[]).join(' / ') : '-';
  const stackHints = Array.isArray(meta.stackHints) ? (meta.stackHints as string[]).join(', ') : '-';
  const suggestedTags = Array.isArray(meta.suggestedTags)
    ? (meta.suggestedTags as string[]).join(', ')
    : '-';
  const versionDetected = typeof meta.versionDetected === 'string' ? meta.versionDetected : '-';
  const changeType = typeof meta.changeType === 'string' ? meta.changeType : '-';
  const actionHint = typeof meta.actionHint === 'string' ? meta.actionHint : '-';
  const migrationNotes = Array.isArray(meta.migrationNotes)
    ? (meta.migrationNotes as string[]).join(' / ')
    : '-';

  return (
    <div className="posts-detail">
      <div className="detail-header">
        <div>
          <h3 className="detail-title">{post.title}</h3>
          <div className="muted detail-meta">
            {getDomain(post.url)} · {new Date(post.savedAt ?? post.publishedAt).toLocaleString()}
          </div>
        </div>
        <div className="detail-actions">
          <a href={post.url} target="_blank" rel="noreferrer" className="action-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M14 5h5v5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 14L19 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 14v5H5V5h5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            원문 열기
          </a>
          <button type="button" className="secondary" onClick={() => onDelete(post.id)} disabled={deleting}>
            삭제
          </button>
        </div>
      </div>

      <div className="badges detail-badges">
        <PostBadges
          category={post.category}
          status={post.status}
          collection={post.collection}
          pinned={post.pinned}
          contentType={post.contentType}
          signals={post.signals}
          maxSignals={6}
        />
      </div>

      <section className="detail-section">
        <strong className="detail-section-title">요약</strong>
        <div className="muted detail-section-body">{post.summaryTldr}</div>
      </section>

      {post.summaryPoints && post.summaryPoints.length > 0 && (
        <section className="detail-section">
          <strong className="detail-section-title">Key Points</strong>
          <ul className="muted detail-section-list">
            {post.summaryPoints.map((point, index) => (
              <li key={`${post.id}-point-${index}`}>{point}</li>
            ))}
          </ul>
        </section>
      )}

      {post.whyItMatters && (
        <section className="detail-section">
          <strong className="detail-section-title">Why it matters</strong>
          <div className="muted detail-section-body">{post.whyItMatters}</div>
        </section>
      )}

      {post.contentType === 'NEWS' && (
        <section className="detail-card">
          <strong className="detail-section-title">키워드</strong>
          <div className="muted detail-section-body">{keywords}</div>
        </section>
      )}

      {post.contentType === 'COMPANY_BLOG' && (
        <section className="detail-card">
          <strong className="detail-section-title">Takeaways</strong>
          <div className="muted detail-section-body">{takeaways}</div>
          <strong className="detail-section-title">Stack</strong>
          <div className="muted detail-section-body">{stackHints}</div>
          <strong className="detail-section-title">추천 태그</strong>
          <div className="muted detail-section-body">{suggestedTags}</div>
        </section>
      )}

      {post.contentType === 'RELEASE_NOTE' && (
        <section className="detail-card">
          <div className="muted detail-section-body">버전: {versionDetected}</div>
          <div className="muted detail-section-body">변경 유형: {changeType}</div>
          <div className="muted detail-section-body">권장 행동: {actionHint}</div>
          <div className="muted detail-section-body">Migration notes: {migrationNotes}</div>
        </section>
      )}

      <section className="detail-section">
        <strong className="detail-section-title">태그</strong>
        <div className="muted detail-section-body">
          {(post.tags ?? []).length > 0 ? (post.tags ?? []).join(', ') : '-'}
        </div>
      </section>

      <section className="detail-section">
        <strong className="detail-section-title">메모</strong>
        <div className="muted detail-section-body">{post.notes || '-'}</div>
      </section>

      {children}
    </div>
  );
}

export default memo(PostDetail);
