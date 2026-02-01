import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata = {
  title: '테크 레이더 MVP',
  description: '기술 레이더 최소 동작 흐름'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <main>
          <header>
            <div>
              <h1>크롤링 서비스</h1>
              <p className="muted">기술 신호를 수집하고 검토한 뒤 저장합니다.</p>
            </div>
            <nav>
              <Link href="/fetch">수집</Link>
              <Link href="/posts">저장함</Link>
              <Link href="/sources">소스</Link>
              <Link href="/presets">프리셋</Link>
              <Link href="/rules">규칙</Link>
              <Link href="/settings">관리</Link>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
