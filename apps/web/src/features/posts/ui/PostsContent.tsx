import { memo, type ReactNode } from 'react';
import PostList from '../components/PostList';
import type { Post } from '../../../entities/post';

type Props = {
  loading: boolean;
  isMobile: boolean;
  showDetail: boolean;
  setShowDetail: (value: boolean) => void;
  posts: Post[];
  selectedIds: Set<string>;
  selectedPostId: string | null;
  onToggleSelect: (id: string) => void;
  onSelectPost: (id: string) => void;
  highlightParts: (text: string) => string[];
  hasMore: boolean;
  loadingMore: boolean;
  onEndReached: () => void;
  detail: ReactNode;
};

function PostsContent({
  loading,
  isMobile,
  showDetail,
  setShowDetail,
  posts,
  selectedIds,
  selectedPostId,
  onToggleSelect,
  onSelectPost,
  highlightParts,
  hasMore,
  loadingMore,
  onEndReached,
  detail
}: Props) {
  if (loading) {
    return (
      <div className="muted" style={{ marginTop: 12 }}>
        불러오는 중...
      </div>
    );
  }

  if (isMobile) {
    if (showDetail) {
      return (
        <div style={{ marginTop: 16 }}>
          <button type="button" className="secondary" onClick={() => setShowDetail(false)}>
            목록으로 돌아가기
          </button>
          <div style={{ marginTop: 12 }}>{detail}</div>
        </div>
      );
    }

    return (
      <div style={{ marginTop: 16 }}>
        <PostList
          posts={posts}
          selectedIds={selectedIds}
          selectedPostId={selectedPostId}
          onToggleSelect={onToggleSelect}
          onSelectPost={onSelectPost}
          highlightParts={highlightParts}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onEndReached={onEndReached}
        />
      </div>
    );
  }

  return (
    <div className="posts-layout">
      <PostList
        posts={posts}
        selectedIds={selectedIds}
        selectedPostId={selectedPostId}
        onToggleSelect={onToggleSelect}
        onSelectPost={onSelectPost}
        highlightParts={highlightParts}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onEndReached={onEndReached}
      />
      {detail}
    </div>
  );
}

export default memo(PostsContent);
