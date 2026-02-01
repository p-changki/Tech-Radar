'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { CONTENT_TYPES } from '../../../shared/constants/categories';

type Post = {
  id: string;
  title: string;
  url: string;
  category: string;
  publishedAt: string;
  contentType: string;
  summaryTemplateVersion?: string | null;
  summaryTldr: string;
  summaryPoints: string[];
  signals: string[];
  whyItMatters: string;
  summaryMeta?: Record<string, unknown> | null;
  tags: string[];
  notes?: string | null;
};

type PostResponse = { post: Post };

type UpdateResponse = { post: Post };

export default function PostDetailPage() {
  const params = useParams();
  const postId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [post, setPost] = useState<Post | null>(null);
  const [contentType, setContentType] = useState<string>('OTHER');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [regenerateSummary, setRegenerateSummary] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const meta = useMemo(() => (post?.summaryMeta ?? {}) as Record<string, unknown>, [post]);
  const keywords = Array.isArray(meta.keywords) ? (meta.keywords as string[]).join(', ') : '-';
  const readingTime = typeof meta.readingTimeSec === 'number' ? meta.readingTimeSec : '-';
  const takeaways = Array.isArray(meta.takeaways) ? (meta.takeaways as string[]).join(' / ') : '-';
  const stackHints = Array.isArray(meta.stackHints) ? (meta.stackHints as string[]).join(', ') : '-';
  const suggestedTags = Array.isArray(meta.suggestedTags) ? (meta.suggestedTags as string[]).join(', ') : '-';
  const suggestedTagList = Array.isArray(meta.suggestedTags)
    ? (meta.suggestedTags as string[]).filter(Boolean)
    : [];
  const versionDetected = typeof meta.versionDetected === 'string' ? meta.versionDetected : '-';
  const changeType = typeof meta.changeType === 'string' ? meta.changeType : '-';
  const actionHint = typeof meta.actionHint === 'string' ? meta.actionHint : '-';
  const migrationNotes = Array.isArray(meta.migrationNotes) ? (meta.migrationNotes as string[]).join(' / ') : '-';

  useEffect(() => {
    if (!postId) return;
    apiFetch<PostResponse>(`/v1/posts/${postId}`)
      .then((response) => {
        setPost(response.post);
        setContentType(response.post.contentType ?? 'OTHER');
        setTagsInput((response.post.tags ?? []).join(', '));
        setNotes(response.post.notes ?? '');
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : '포스트를 불러오지 못했습니다.');
      });
  }, [postId]);

  const saveChanges = async () => {
    if (!postId) return;
    setLoading(true);
    setMessage(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const response = await apiFetch<UpdateResponse>(
        `/v1/posts/${postId}?regenerateSummary=${regenerateSummary ? 'true' : 'false'}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            contentType,
            tags,
            notes: notes || null
          })
        }
      );

      setPost(response.post);
      setMessage('저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const addTag = (tag: string) => {
    const current = tagsInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const exists = current.some((value) => value.toLowerCase() === tag.toLowerCase());
    if (exists) return;
    const next = [...current, tag];
    setTagsInput(next.join(', '));
  };

  if (!post) {
    return (
      <section className="section">
        <h2>포스트 상세</h2>
        <div className="muted">불러오는 중...</div>
      </section>
    );
  }

  return (
    <section className="section">
      <h2>포스트 상세</h2>
      {message && <div className="notice">{message}</div>}

      <div className="list" style={{ marginTop: 12 }}>
        <div className="card">
          <strong>{post.title}</strong>
          <div className="muted">
            <a href={post.url} target="_blank" rel="noreferrer">
              {post.url}
            </a>
          </div>
          <div className="muted">{new Date(post.publishedAt).toLocaleString()}</div>
          <div className="badges">
            <span className="badge">{post.category}</span>
            <span className="badge">{post.contentType}</span>
            {post.signals?.map((signal) => (
              <span key={signal} className="badge">
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <h2>요약</h2>
        <div className="muted">{post.summaryTldr}</div>
        <ul className="muted" style={{ marginTop: 8 }}>
          {post.summaryPoints?.map((point, index) => (
            <li key={`${point}-${index}`}>{point}</li>
          ))}
        </ul>
        <div className="muted" style={{ marginTop: 8 }}>
          {post.whyItMatters}
        </div>

        {post.contentType === 'NEWS' && (
          <div className="card" style={{ marginTop: 12, padding: 10 }}>
            <strong>키워드</strong>
            <div className="muted" style={{ fontSize: 12 }}>
              {keywords}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              읽기 시간: {readingTime}초
            </div>
          </div>
        )}

        {post.contentType === 'COMPANY_BLOG' && (
          <div className="card" style={{ marginTop: 12 }}>
            <strong>Takeaways</strong>
            <div className="muted">{takeaways}</div>
            <strong style={{ marginTop: 8 }}>Stack</strong>
            <div className="muted">{stackHints}</div>
            <strong style={{ marginTop: 8 }}>추천 태그</strong>
            <div className="muted">{suggestedTags}</div>
          </div>
        )}

        {post.contentType === 'RELEASE_NOTE' && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="muted">버전: {versionDetected}</div>
            <div className="muted">변경 유형: {changeType}</div>
            <div className="muted">권장 행동: {actionHint}</div>
            <div className="muted">Migration notes: {migrationNotes}</div>
          </div>
        )}
      </div>

      <div className="section" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>편집</h2>
          <button type="button" className="secondary" onClick={() => setShowEdit((prev) => !prev)}>
            {showEdit ? '접기' : '펼치기'}
          </button>
        </div>
        {showEdit && (
          <>
            {suggestedTagList.length > 0 && (
              <div className="card" style={{ marginBottom: 12 }}>
                <strong>추천 태그</strong>
                <div className="badges" style={{ marginTop: 8 }}>
                  {suggestedTagList.map((tag) => (
                    <button key={tag} type="button" className="badge" onClick={() => addTag(tag)}>
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="input-grid">
              <label>
                콘텐츠 타입
                <select value={contentType} onChange={(event) => setContentType(event.target.value)}>
                  {CONTENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                태그 (쉼표로 구분)
                <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} />
              </label>
              <label>
                노트
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
              </label>
            </div>
            <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
              <input
                type="checkbox"
                checked={regenerateSummary}
                onChange={(event) => setRegenerateSummary(event.target.checked)}
              />
              타입 변경 시 요약 재생성
            </label>
            <div className="actions" style={{ marginTop: 12 }}>
              <button type="button" onClick={saveChanges} disabled={loading}>
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
