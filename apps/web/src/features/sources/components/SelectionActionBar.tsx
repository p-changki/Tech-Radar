'use client';

import type { Preset } from '../types';

type Props = {
  selectedCount: number;
  allSelected: boolean;
  presets: Preset[];
  presetId: string;
  onPresetChange: (value: string) => void;
  onAddToPreset: () => void;
  onEnableSelected: () => void;
  onDisableSelected: () => void;
  onDeleteSelected: () => void;
  onToggleSelectAll: () => void;
  onOpenAddModal: () => void;
  deleting: boolean;
  disableBulk: boolean;
};

export default function SelectionActionBar({
  selectedCount,
  allSelected,
  presets,
  presetId,
  onPresetChange,
  onAddToPreset,
  onEnableSelected,
  onDisableSelected,
  onDeleteSelected,
  onToggleSelectAll,
  onOpenAddModal,
  deleting,
  disableBulk
}: Props) {
  return (
    <div className="sources-actionbar">
      <div className="sources-actionbar-left">
        <button type="button" onClick={onOpenAddModal}>
          + 소스 추가
        </button>
        <button type="button" className="secondary" onClick={onToggleSelectAll} disabled={disableBulk}>
          {allSelected ? '전체 해제' : '전체 선택'}
        </button>
      </div>
      <div className="sources-actionbar-right">
        <span className="muted">선택 {selectedCount}개</span>
        <select value={presetId} onChange={(event) => onPresetChange(event.target.value)}>
          <option value="">프리셋 선택</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} ({preset.sourceCount ?? 0})
            </option>
          ))}
        </select>
        <button type="button" className="secondary" onClick={onAddToPreset} disabled={!presetId || selectedCount === 0}>
          프리셋에 추가
        </button>
        <button type="button" className="secondary" onClick={onEnableSelected} disabled={selectedCount === 0}>
          활성화
        </button>
        <button type="button" className="secondary" onClick={onDisableSelected} disabled={selectedCount === 0}>
          비활성화
        </button>
        <button type="button" className="secondary" onClick={onDeleteSelected} disabled={selectedCount === 0 || deleting}>
          {deleting ? '삭제 중...' : '선택 삭제'}
        </button>
      </div>
    </div>
  );
}
