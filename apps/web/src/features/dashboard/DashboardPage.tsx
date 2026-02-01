'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { getDomain } from '../../shared/lib/url';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, ArcElement, LineElement, PointElement, Tooltip, Legend);

type PostSummary = {
  id: string;
  title: string;
  url: string;
  summaryTldr?: string | null;
  signals?: string[];
  contentType?: string | null;
  category?: string;
  savedAt?: string | null;
  publishedAt?: string | null;
};

type Source = {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  lastStatus?: number | null;
  lastFetchedAt?: string | null;
};

type Rule = {
  id: string;
  enabled: boolean;
  action: string;
  pattern: string;
};

type FetchSummary = {
  date: string;
  label: string;
  count: number;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ko-KR');
};

const statusTone = (status?: number | null) => {
  if (!status) return 'neutral';
  if (status >= 200 && status < 300) return 'ok';
  if (status === 304) return 'soft';
  return 'fail';
};

export default function DashboardPage() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [fetchSummary, setFetchSummary] = useState<FetchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      apiFetch<{ posts: PostSummary[] }>('/v1/posts?limit=20'),
      apiFetch<{ sources: Source[] }>('/v1/sources'),
      apiFetch<{ rules: Rule[] }>('/v1/rules'),
      apiFetch<{ days: FetchSummary[] }>('/v1/fetch/summary?days=7')
    ])
      .then((results) => {
        if (!active) return;
        const [postsResult, sourcesResult, rulesResult, summaryResult] = results;
        if (postsResult.status === 'fulfilled') {
          setPosts(postsResult.value.posts ?? []);
        } else {
          setPosts([]);
          setError('대시보드 데이터를 일부 불러오지 못했습니다.');
        }
        if (sourcesResult.status === 'fulfilled') {
          setSources(sourcesResult.value.sources ?? []);
        } else {
          setSources([]);
          setError('대시보드 데이터를 일부 불러오지 못했습니다.');
        }
        if (rulesResult.status === 'fulfilled') {
          setRules(rulesResult.value.rules ?? []);
        } else {
          setRules([]);
          setError('대시보드 데이터를 일부 불러오지 못했습니다.');
        }
        if (summaryResult.status === 'fulfilled') {
          setFetchSummary(summaryResult.value.days ?? []);
        } else {
          setFetchSummary([]);
          setError('대시보드 데이터를 일부 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const enabledSources = useMemo(() => sources.filter((source) => source.enabled), [sources]);
  const categoryDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      const category = post.category ?? 'OTHER';
      counts[category] = (counts[category] ?? 0) + 1;
    });
    return counts;
  }, [posts]);

  const categoryChartData = useMemo(() => {
    const labels = Object.keys(categoryDistribution);
    return {
      labels: labels.length ? labels : ['EMPTY'],
      datasets: [
        {
          data: labels.length ? labels.map((label) => categoryDistribution[label]) : [1],
          backgroundColor: ['#38bdf8', '#fbbf24', '#f472b6', '#34d399', '#a78bfa', '#94a3b8']
        }
      ]
    };
  }, [categoryDistribution]);

  const fetchChartData = useMemo(() => {
    const labels = fetchSummary.map((item) => item.label);
    const counts = fetchSummary.map((item) => item.count);
    return {
      labels: labels.length ? labels : ['—'],
      datasets: [
        {
          label: '수집량',
          data: counts.length ? counts : [0],
          borderColor: '#2c7ef7',
          backgroundColor: 'rgba(44, 126, 247, 0.15)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.35,
          fill: true
        }
      ]
    };
  }, [fetchSummary]);
  const recentPosts = useMemo(() => posts.slice(0, 5), [posts]);
  const sourceStatus = useMemo(() => sources.slice(0, 6), [sources]);

  return (
    <section className="dashboard">
      <div className="dashboard-hero">
        <div>
          <p className="dashboard-eyebrow">테크 레이더 대시보드</p>
          <h2>오늘의 기술 신호를 한눈에.</h2>
          <p className="muted">
            최신 수집 상태, 저장된 항목, 주요 신호를 요약해서 보여줍니다.
          </p>
        </div>
        <div className="dashboard-actions">
          <Link href="/fetch">
            <button type="button">지금 수집하기</button>
          </Link>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="dashboard-stats">
        <div className="dashboard-card">
          <p className="dashboard-label">저장된 포스트</p>
          <h3>{loading ? '…' : posts.length}</h3>
          <p className="dashboard-sub">최근 20개 기준</p>
        </div>
        <div className="dashboard-card">
          <p className="dashboard-label">등록된 소스</p>
          <h3>{loading ? '…' : sources.length}</h3>
          <p className="dashboard-sub">전체 소스</p>
        </div>
        <div className="dashboard-card">
          <p className="dashboard-label">활성 소스</p>
          <h3>{loading ? '…' : enabledSources.length}</h3>
          <p className="dashboard-sub">현재 수집 대상</p>
        </div>
        <div className="dashboard-card dashboard-card-alert">
          <p className="dashboard-label">규칙 수</p>
          <h3>{loading ? '…' : rules.length}</h3>
          <p className="dashboard-sub">활성 규칙 포함</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>최근 7일 수집량</h3>
            <Link href="/posts" className="ghost-link">
              저장함 보기
            </Link>
          </div>
          <div className="chart-grid">
            <div className="chart-card chart-card-wide">
              <p className="muted">Fetch volume</p>
              <div className="chart-box chart-box-wide">
                <Line
                  data={fetchChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { ticks: { precision: 0 } }
                    }
                  }}
                />
              </div>
            </div>
            <div className="chart-card">
              <p className="muted">Categories</p>
              <div className="chart-box">
                <Doughnut
                  data={categoryChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>최근 저장됨</h3>
            <Link href="/posts" className="ghost-link">
              저장함 관리
            </Link>
          </div>
          <div className="dashboard-list">
            {recentPosts.length === 0 && (
              <div className="dashboard-empty">아직 저장된 항목이 없습니다.</div>
            )}
            {recentPosts.map((post) => (
              <Link key={post.id} href={`/posts?selected=${post.id}`} className="dashboard-list-item">
                <div>
                  <strong className="clamp-1">{post.title}</strong>
                  <p className="muted clamp-1">{post.summaryTldr ?? '요약 준비 중'}</p>
                </div>
                <div className="dashboard-list-meta">
                  <span className="badge">{post.category ?? '기타'}</span>
                  <span className="muted">{formatDate(post.savedAt ?? post.publishedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="dashboard-panel-header">
          <h3>소스 상태</h3>
          <Link href="/sources" className="ghost-link">
            소스 관리
          </Link>
        </div>
        <div className="dashboard-source-grid">
          {sourceStatus.length === 0 && (
            <div className="dashboard-empty">등록된 소스가 없습니다.</div>
          )}
          {sourceStatus.map((source) => (
            <div key={source.id} className="dashboard-source-pill">
              <span className={`status-dot ${statusTone(source.lastStatus)}`} />
              <div>
                <p>{source.name}</p>
                <span className="muted">
                  {getDomain(source.key)} · {source.lastStatus ?? '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
