import { useCallback, useEffect, useState } from 'react';
import type { Post } from '../../../entities/post';

type Args = {
  posts: Post[];
  selectedFromQuery: string | null;
  updateUrl: (selectedId?: string | null) => void;
};

export type UsePostSelectionReturn = {
  selectedPostId: string | null;
  setSelectedPostId: (value: string | null) => void;
  isMobile: boolean;
  showDetail: boolean;
  setShowDetail: (value: boolean) => void;
  handleSelectPost: (id: string) => void;
};

export function usePostSelection({ posts, selectedFromQuery, updateUrl }: Args): UsePostSelectionReturn {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.matchMedia('(max-width: 900px)').matches);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    setSelectedPostId(selectedFromQuery);
  }, [selectedFromQuery]);

  useEffect(() => {
    if (posts.length === 0) {
      setSelectedPostId(null);
      return;
    }
    if (selectedPostId && posts.some((post) => post.id === selectedPostId)) {
      return;
    }
    const first = posts[0]?.id ?? null;
    if (first) {
      setSelectedPostId(first);
      updateUrl(first);
    }
  }, [posts, selectedPostId, updateUrl]);

  const handleSelectPost = useCallback(
    (id: string) => {
      setSelectedPostId(id);
      updateUrl(id);
      if (isMobile) setShowDetail(true);
    },
    [updateUrl, isMobile]
  );

  return { selectedPostId, setSelectedPostId, isMobile, showDetail, setShowDetail, handleSelectPost };
}
