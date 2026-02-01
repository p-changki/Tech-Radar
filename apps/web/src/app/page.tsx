import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="section">
      <h2>빠른 시작</h2>
      <p className="muted">수집 페이지에서 아이템을 생성하고 저장함에 보관하세요.</p>
      <div className="actions">
        <Link href="/fetch">
          <button type="button">수집으로 이동</button>
        </Link>
        <Link href="/posts">
          <button type="button" className="secondary">
            저장함 보기
          </button>
        </Link>
      </div>
    </section>
  );
}
