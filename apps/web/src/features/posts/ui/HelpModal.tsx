import { memo } from 'react';
import { Modal } from '../../../shared/ui';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

function HelpModal({ isOpen, onClose }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="저장함 사용법">
      <ol className="muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        <li>좌측 리스트에서 항목을 클릭하면 우측 상세가 바뀝니다.</li>
        <li>검색/필터/정렬을 조합한 뒤 “현재 뷰 저장”으로 빠르게 재사용하세요.</li>
        <li>Pin(⭐)은 상세 패널 하단 “편집”에서 고정으로 설정할 수 있습니다.</li>
        <li>체크박스로 여러 건을 선택하고 상단 “선택 삭제”로 일괄 관리할 수 있습니다.</li>
        <li>상세 패널에서 원문 열기/메모/태그/요약 재생성을 할 수 있습니다.</li>
      </ol>
    </Modal>
  );
}

export default memo(HelpModal);
