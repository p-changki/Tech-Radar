"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useHighlightParts,
  usePostEdit,
  usePostSelection,
  usePostsData,
  usePostsFilters,
  useSavedViews,
} from "./model";
import {
  HelpModal,
  PostDetail,
  PostEditForm,
  PostsContent,
  PostsFilterBar,
  PostsHeader,
  SavedViewsBar,
} from "./ui";

export default function PostsPage() {
  const searchParams = useSearchParams();
  const filters = usePostsFilters();
  const {
    posts,
    loading,
    loadingMore,
    deleting,
    hasMore,
    message,
    selectedIds,
    allSelected,
    setMessage,
    loadPosts,
    loadMore,
    toggleSelection,
    toggleAll,
    deletePosts,
    updatePost,
  } = usePostsData(filters.buildQuery);
  const [showHelp, setShowHelp] = useState(false);
  const selection = usePostSelection({
    posts,
    selectedFromQuery: searchParams.get("selected"),
    updateUrl: filters.updateUrl,
  });
  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selection.selectedPostId) ?? null,
    [posts, selection.selectedPostId]
  );
  const {
    debouncedQuery,
    categoryFilter,
    contentTypeFilter,
    signalFilter,
    sortOrder,
    statusFilter,
    collectionFilter,
    pinnedOnly,
    lookbackDays,
    updateUrl
  } = filters;
  const savedViewsState = useSavedViews({ filters });
  const edit = usePostEdit({
    selectedPost,
    onPostUpdated: updatePost,
    setMessage,
  });

  useEffect(() => {
    updateUrl(selection.selectedPostId);
  }, [
    debouncedQuery,
    categoryFilter,
    contentTypeFilter,
    signalFilter,
    sortOrder,
    statusFilter,
    collectionFilter,
    pinnedOnly,
    lookbackDays,
    selection.selectedPostId,
    updateUrl
  ]);

  useEffect(() => {
    loadPosts();
  }, [
    debouncedQuery,
    categoryFilter,
    contentTypeFilter,
    signalFilter,
    sortOrder,
    statusFilter,
    collectionFilter,
    pinnedOnly,
    lookbackDays,
    loadPosts
  ]);

  const highlightParts = useHighlightParts(debouncedQuery);
  const handleDelete = useCallback(
    async (ids: string[]) => {
      const deleted = await deletePosts(ids);
      if (
        selection.selectedPostId &&
        deleted.includes(selection.selectedPostId)
      ) {
        selection.setSelectedPostId(null);
      }
    },
    [deletePosts, selection]
  );

  return (
    <section className="section">
      <PostsHeader
        selectedCount={selectedIds.size}
        allSelected={allSelected}
        deleting={deleting}
        onToggleAll={toggleAll}
        onDeleteSelected={() => handleDelete(Array.from(selectedIds))}
        onShowHelp={() => setShowHelp(true)}
        hasPosts={posts.length > 0}
      />

      {message && <div className="notice">{message}</div>}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <SavedViewsBar
        savedViews={savedViewsState.savedViews}
        activeViewId={savedViewsState.activeViewId}
        onApplyView={savedViewsState.applyView}
        onDeleteView={savedViewsState.deleteView}
        onSaveView={savedViewsState.saveView}
      />

      <PostsFilterBar filters={filters} />

      <PostsContent
        loading={loading}
        isMobile={selection.isMobile}
        showDetail={selection.showDetail}
        setShowDetail={selection.setShowDetail}
        posts={posts}
        selectedIds={selectedIds}
        selectedPostId={selection.selectedPostId}
        onToggleSelect={toggleSelection}
        onSelectPost={selection.handleSelectPost}
        highlightParts={highlightParts}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onEndReached={loadMore}
        detail={
          <PostDetail
            post={selectedPost}
            onDelete={(id) => handleDelete([id])}
            deleting={deleting}
          >
            <PostEditForm {...edit} />
          </PostDetail>
        }
      />
    </section>
  );
}
