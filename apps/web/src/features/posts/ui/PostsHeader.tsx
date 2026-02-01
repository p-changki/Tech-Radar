import { memo } from 'react';

type Props = {
  selectedCount: number;
  allSelected: boolean;
  deleting: boolean;
  onToggleAll: () => void;
  onDeleteSelected: () => void;
  onShowHelp: () => void;
  hasPosts: boolean;
};

function PostsHeader({
  selectedCount,
  allSelected,
  deleting,
  onToggleAll,
  onDeleteSelected,
  onShowHelp,
  hasPosts
}: Props) {
  return (
    <div className="posts-header">
      <div>
        <h2 style={{ margin: 0 }}>저장함</h2>
      </div>
      <div className="actions">
        <button type="button" className="secondary" onClick={onShowHelp}>
          사용법
        </button>
        <button type="button" className="secondary" onClick={onToggleAll} disabled={!hasPosts}>
          {allSelected ? '전체 해제' : '전체 선택'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0 || deleting}
        >
          {deleting ? '삭제 중...' : `선택 삭제 (${selectedCount})`}
        </button>
      </div>
    </div>
  );
}

export default memo(PostsHeader);
