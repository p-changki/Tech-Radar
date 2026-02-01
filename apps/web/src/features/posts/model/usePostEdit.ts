import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import type { Post } from '../../../entities/post';
import { CONTENT_TYPES, STATUSES } from '../../../shared/constants/categories';

type UsePostEditArgs = {
  selectedPost: Post | null;
  onPostUpdated: (post: Post) => void;
  setMessage: (value: string | null) => void;
};

export type UsePostEditReturn = {
  editOpen: boolean;
  setEditOpen: (value: boolean) => void;
  editContentType: string;
  setEditContentType: (value: string) => void;
  editStatus: string;
  setEditStatus: (value: string) => void;
  editCollection: string;
  setEditCollection: (value: string) => void;
  editPinned: boolean;
  setEditPinned: (value: boolean) => void;
  tagsInput: string;
  setTagsInput: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  regenerateSummary: boolean;
  setRegenerateSummary: (value: boolean) => void;
  saving: boolean;
  saveChanges: () => Promise<void>;
  contentTypes: typeof CONTENT_TYPES;
  statuses: typeof STATUSES;
};

export function usePostEdit({
  selectedPost,
  onPostUpdated,
  setMessage
}: UsePostEditArgs): UsePostEditReturn {
  const [editOpen, setEditOpen] = useState(false);
  const [editContentType, setEditContentType] = useState('OTHER');
  const [editStatus, setEditStatus] = useState('inbox');
  const [editCollection, setEditCollection] = useState('');
  const [editPinned, setEditPinned] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [regenerateSummary, setRegenerateSummary] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedPost) return;
    setEditContentType(selectedPost.contentType ?? 'OTHER');
    setEditStatus(selectedPost.status ?? 'inbox');
    setEditCollection(selectedPost.collection ?? '');
    setEditPinned(Boolean(selectedPost.pinned));
    setTagsInput((selectedPost.tags ?? []).join(', '));
    setNotes(selectedPost.notes ?? '');
    setRegenerateSummary(true);
    setEditOpen(false);
  }, [selectedPost]);

  const saveChanges = useCallback(async () => {
    if (!selectedPost) return;
    setSaving(true);
    setMessage(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const response = await apiFetch<{ post: Post }>(
        `/v1/posts/${selectedPost.id}?regenerateSummary=${regenerateSummary ? 'true' : 'false'}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            contentType: editContentType,
            status: editStatus,
            collection: editCollection || null,
            pinned: editPinned,
            tags,
            notes: notes || null
          })
        }
      );

      onPostUpdated(response.post);
      setMessage('저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [
    selectedPost,
    editContentType,
    editStatus,
    editCollection,
    editPinned,
    tagsInput,
    notes,
    regenerateSummary,
    onPostUpdated,
    setMessage
  ]);

  return {
    editOpen,
    setEditOpen,
    editContentType,
    setEditContentType,
    editStatus,
    setEditStatus,
    editCollection,
    setEditCollection,
    editPinned,
    setEditPinned,
    tagsInput,
    setTagsInput,
    notes,
    setNotes,
    regenerateSummary,
    setRegenerateSummary,
    saving,
    saveChanges,
    contentTypes: CONTENT_TYPES,
    statuses: STATUSES
  };
}
