import { useCallback, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import type { Post, PostsResponse } from '../../../entities/post';

export type UsePostsDataReturn = {
  posts: Post[];
  loading: boolean;
  loadingMore: boolean;
  deleting: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  message: string | null;
  selectedIds: Set<string>;
  allSelected: boolean;
  setMessage: (value: string | null) => void;
  loadPosts: () => Promise<void>;
  loadMore: () => Promise<void>;
  toggleSelection: (id: string) => void;
  toggleAll: () => void;
  deletePosts: (ids: string[]) => Promise<string[]>;
  updatePost: (post: Post) => void;
};

export function usePostsData(buildQuery: (cursor?: string) => string): UsePostsDataReturn {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setNextCursor(null);
    setHasMore(false);
    setMessage(null);
    try {
      const queryString = buildQuery();
      const response = await apiFetch<PostsResponse>(`/v1/posts?${queryString}`);
      setPosts(response.posts ?? []);
      setNextCursor(response.nextCursor ?? null);
      setHasMore(Boolean(response.hasMore));
      setSelectedIds(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장된 항목을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    setMessage(null);
    try {
      const queryString = buildQuery(nextCursor);
      const response = await apiFetch<PostsResponse>(`/v1/posts?${queryString}`);
      setPosts((prev) => [...prev, ...(response.posts ?? [])]);
      setNextCursor(response.nextCursor ?? null);
      setHasMore(Boolean(response.hasMore));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장된 항목을 불러오지 못했습니다.');
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, hasMore, loadingMore, nextCursor]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allSelected = posts.length > 0 && posts.every((post) => selectedIds.has(post.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(posts.map((post) => post.id)));
  }, [allSelected, posts]);

  const deletePosts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return [];
    setDeleting(true);
    setMessage(null);
    try {
      await apiFetch<{ deletedCount: number }>('/v1/posts', {
        method: 'DELETE',
        body: JSON.stringify({ ids })
      });
      setPosts((prev) => prev.filter((post) => !ids.includes(post.id)));
      setSelectedIds(new Set());
      setMessage('선택한 항목을 삭제했습니다.');
      return ids;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '삭제에 실패했습니다.');
      return [];
    } finally {
      setDeleting(false);
    }
  }, []);

  const updatePost = useCallback((post: Post) => {
    setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)));
  }, []);

  return {
    posts,
    loading,
    loadingMore,
    deleting,
    hasMore,
    nextCursor,
    message,
    selectedIds,
    allSelected,
    setMessage,
    loadPosts,
    loadMore,
    toggleSelection,
    toggleAll,
    deletePosts,
    updatePost
  };
}
