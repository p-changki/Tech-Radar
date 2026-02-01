import { memo } from 'react';
import { BASE_VIEWS } from '../model/useSavedViews';
import type { SavedView } from '../../../entities/post';

type Props = {
  savedViews: SavedView[];
  activeViewId: string | null;
  onApplyView: (view?: SavedView) => void;
  onDeleteView: (id: string) => void;
  onSaveView: () => void;
};

function SavedViewsBar({ savedViews, activeViewId, onApplyView, onDeleteView, onSaveView }: Props) {
  return (
    <div className="saved-views">
      {BASE_VIEWS.map((view) => (
        <div key={view.id} className={`saved-view ${activeViewId === view.id ? 'active' : ''}`}>
          <button type="button" onClick={() => onApplyView(view)}>
            {view.name}
          </button>
        </div>
      ))}
      {savedViews.map((view) => (
        <div key={view.id} className={`saved-view ${activeViewId === view.id ? 'active' : ''}`}>
          <button type="button" onClick={() => onApplyView(view)}>
            {view.name}
          </button>
          <button type="button" className="secondary" onClick={() => onDeleteView(view.id)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={onSaveView}>
        + 현재 뷰 저장
      </button>
    </div>
  );
}

export default memo(SavedViewsBar);
