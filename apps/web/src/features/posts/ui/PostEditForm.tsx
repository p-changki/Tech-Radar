import { memo } from 'react';
import type { UsePostEditReturn } from '../model/usePostEdit';
import { STATUS_LABELS } from '../../../shared/constants/categories';

type Props = UsePostEditReturn;

function PostEditForm({
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
  contentTypes,
  statuses
}: Props) {
  return (
    <section className="detail-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>편집</strong>
        <button type="button" className="secondary" onClick={() => setEditOpen(!editOpen)}>
          {editOpen ? '접기' : '펼치기'}
        </button>
      </div>
      {editOpen && (
        <div className="input-grid" style={{ marginTop: 12 }}>
          <label>
            타입
            <select value={editContentType} onChange={(event) => setEditContentType(event.target.value)}>
              {contentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            상태
            <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            컬렉션
            <input
              value={editCollection}
              onChange={(event) => setEditCollection(event.target.value)}
              placeholder="예: security, infra"
            />
          </label>
          <label>
            Pin
            <select value={editPinned ? 'true' : 'false'} onChange={(event) => setEditPinned(event.target.value === 'true')}>
              <option value="false">끄기</option>
              <option value="true">고정</option>
            </select>
          </label>
          <label>
            태그 (쉼표 구분)
            <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            메모
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <label>
            요약 재생성
            <select value={regenerateSummary ? 'yes' : 'no'} onChange={(event) => setRegenerateSummary(event.target.value === 'yes')}>
              <option value="yes">예</option>
              <option value="no">아니오</option>
            </select>
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" onClick={saveChanges} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(PostEditForm);
