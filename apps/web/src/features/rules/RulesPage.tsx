'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';

type Rule = {
  id: string;
  type: string;
  pattern: string;
  action: string;
  weight: number;
  enabled: boolean;
};

type RulesResponse = { rules: Rule[] };

type CreateRuleResponse = { rule: Rule };

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [pattern, setPattern] = useState('');
  const [type, setType] = useState('keyword');
  const [action, setAction] = useState('boost');
  const [weight, setWeight] = useState(5);
  const [previewDays, setPreviewDays] = useState(7);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewImpact, setPreviewImpact] = useState<string | null>(null);
  const [previewSamples, setPreviewSamples] = useState<
    { id: string; title: string; url: string; sourceDomain: string; savedAt?: string; publishedAt?: string }[]
  >([]);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewImpactRate, setPreviewImpactRate] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const typeLabel: Record<string, string> = {
    keyword: '키워드',
    domain: '도메인',
    source: '소스'
  };
  const actionLabel: Record<string, string> = {
    boost: '증가',
    mute: '무시'
  };

  const quickPresets = useMemo(
    () => [
      {
        key: 'noise',
        label: 'Noise',
        description: '채용/이벤트/세미나 등 노이즈 제거',
        rules: [
          { type: 'keyword', action: 'mute', pattern: '채용', weight: 100 },
          { type: 'keyword', action: 'mute', pattern: 'recruit', weight: 100 },
          { type: 'keyword', action: 'mute', pattern: 'recruiting', weight: 100 },
          { type: 'keyword', action: 'mute', pattern: '이벤트', weight: 100 },
          { type: 'keyword', action: 'mute', pattern: '행사', weight: 100 },
          { type: 'keyword', action: 'mute', pattern: '세미나', weight: 100 },
          { type: 'keyword', action: 'mute', pattern: '웨비나', weight: 100 },
          { type: 'keyword', action: 'mute', pattern: '컨퍼런스', weight: 100 },
          { type: 'keyword', action: 'mute', pattern: 'meetup', weight: 100 }
        ]
      },
      {
        key: 'security',
        label: 'Security',
        description: '보안 이슈 우선',
        rules: [
          { type: 'keyword', action: 'boost', pattern: 'CVE', weight: 5 },
          { type: 'keyword', action: 'boost', pattern: 'vulnerability', weight: 3 },
          { type: 'keyword', action: 'boost', pattern: 'security', weight: 3 },
          { type: 'keyword', action: 'boost', pattern: 'patch', weight: 2 },
          { type: 'keyword', action: 'boost', pattern: 'advisory', weight: 2 },
          { type: 'keyword', action: 'boost', pattern: '취약', weight: 3 },
          { type: 'keyword', action: 'boost', pattern: '보안', weight: 3 }
        ]
      },
      {
        key: 'release',
        label: 'Release',
        description: '릴리즈/중대 변경 강조',
        rules: [
          { type: 'keyword', action: 'boost', pattern: 'breaking', weight: 4 },
          { type: 'keyword', action: 'boost', pattern: 'major', weight: 3 },
          { type: 'keyword', action: 'boost', pattern: 'deprecated', weight: 3 },
          { type: 'keyword', action: 'boost', pattern: 'deprecation', weight: 3 },
          { type: 'keyword', action: 'boost', pattern: 'removed', weight: 2 },
          { type: 'keyword', action: 'boost', pattern: 'EOL', weight: 3 },
          { type: 'keyword', action: 'boost', pattern: 'migration', weight: 3 },
          { type: 'keyword', action: 'boost', pattern: 'release', weight: 2 }
        ]
      }
    ],
    []
  );

  const loadRules = async () => {
    const response = await apiFetch<RulesResponse>('/v1/rules');
    setRules(response.rules ?? []);
  };

  useEffect(() => {
    loadRules().catch((error) => {
      setMessage(error instanceof Error ? error.message : '규칙을 불러오지 못했습니다.');
    });
  }, []);

  const createRule = async () => {
    if (!pattern.trim()) return;
    try {
      const response = await apiFetch<CreateRuleResponse>('/v1/rules', {
        method: 'POST',
        body: JSON.stringify({
          type,
          pattern,
          action,
          weight,
          enabled: true
        })
      });
      setRules((prev) => [response.rule, ...prev]);
      setPattern('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '규칙 생성에 실패했습니다.');
    }
  };

  const updateRule = async (id: string, data: Partial<Rule>) => {
    try {
      const response = await apiFetch<{ rule: Rule }>(`/v1/rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      setRules((prev) => prev.map((rule) => (rule.id === id ? response.rule : rule)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '규칙 업데이트에 실패했습니다.');
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await apiFetch(`/v1/rules/${id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((rule) => rule.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '규칙 삭제에 실패했습니다.');
    }
  };

  const applyPreset = async (presetKey: string) => {
    const preset = quickPresets.find((item) => item.key === presetKey);
    if (!preset) return;
    const tasks = buildPresetTasks(preset.rules);
    await createRules(tasks, `${preset.label} 규칙 ${tasks.length}개를 추가했습니다.`);
  };

  const buildPresetTasks = (presetRules: { type: string; action: string; pattern: string; weight: number }[]) => {
    const existing = new Set(rules.map((rule) => `${rule.type}|${rule.action}|${rule.pattern}`));
    return presetRules.filter((rule) => !existing.has(`${rule.type}|${rule.action}|${rule.pattern}`));
  };

  const createRules = async (tasks: { type: string; action: string; pattern: string; weight: number }[], successMessage: string) => {
    if (tasks.length === 0) {
      setMessage('이미 동일한 규칙이 존재합니다.');
      return;
    }
    try {
      const created = await Promise.all(
        tasks.map((rule) =>
          apiFetch<CreateRuleResponse>('/v1/rules', {
            method: 'POST',
            body: JSON.stringify({ ...rule, enabled: true })
          })
        )
      );
      setRules((prev) => [...created.map((result) => result.rule), ...prev]);
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프리셋 적용에 실패했습니다.');
    }
  };

  const applyRecommended = async () => {
    const recommendedRules = [
      { type: 'keyword', action: 'mute', pattern: '채용', weight: 100 },
      { type: 'keyword', action: 'boost', pattern: 'CVE', weight: 5 },
      { type: 'keyword', action: 'boost', pattern: 'security', weight: 3 },
      { type: 'keyword', action: 'boost', pattern: 'breaking', weight: 4 },
      { type: 'keyword', action: 'boost', pattern: 'deprecated', weight: 3 }
    ];
    const tasks = buildPresetTasks(recommendedRules);
    await createRules(tasks, `추천 세팅(핵심) 규칙 ${tasks.length}개를 추가했습니다.`);
  };

  const requestPreview = useCallback(async () => {
    if (!pattern.trim()) {
      setPreviewCount(null);
      setPreviewSamples([]);
      setPreviewImpact(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewMessage(null);
    try {
      const response = await apiFetch<{
        count: number;
        impact?: string;
        impactRate?: number;
        total?: number;
        samples: { id: string; title: string; url: string; sourceDomain: string; savedAt?: string; publishedAt?: string }[];
      }>('/v1/rules/preview', {
        method: 'POST',
        body: JSON.stringify({
          type,
          action,
          weight,
          pattern,
          days: previewDays
        })
      });
      setPreviewCount(response.count ?? 0);
      setPreviewImpact(response.impact ?? null);
      setPreviewImpactRate(typeof response.impactRate === 'number' ? response.impactRate : null);
      setPreviewTotal(typeof response.total === 'number' ? response.total : null);
      setPreviewSamples(response.samples ?? []);
    } catch (error) {
      setPreviewMessage(error instanceof Error ? error.message : 'Preview 실패: 네트워크/서버 오류');
    } finally {
      setPreviewLoading(false);
    }
  }, [pattern, type, action, weight, previewDays]);

  useEffect(() => {
    const timer = setTimeout(() => {
      requestPreview().catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [requestPreview]);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  return (
    <section className="section">
      <h2>규칙</h2>
      <div className="actions" style={{ marginBottom: 12 }}>
        <button type="button" className="secondary" onClick={() => setShowHelp(true)}>
          사용법
        </button>
      </div>
      {message && <div className="notice">{message}</div>}
      {showHelp && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowHelp(false)}>
          <div
            className="modal-panel rules-help-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>규칙 사용법</h3>
              <button type="button" className="secondary" onClick={() => setShowHelp(false)}>
                닫기
              </button>
            </div>
            <div className="muted" style={{ display: 'grid', gap: 12, lineHeight: 1.7 }}>
              <div>
                <strong>규칙 페이지 사용법</strong>
                <p>
                  이 페이지는 수집된 글을 “더 내 취향/목적에 맞게” 필터링하고 우선순위를 조정하는 곳입니다.
                  규칙은 수집 결과(Inbox)에 영향을 주며, 보기 싫은 글은 걸러내고(Mute), 중요한 글은 더 잘 뜨게(Boost)
                  만들 수 있습니다.
                </p>
              </div>

              <div>
                <strong>1) 규칙이 어디에 영향을 주나요?</strong>
                <p>수집 흐름은 보통 이렇게 진행됩니다.</p>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>RSS/HTML에서 글을 수집</li>
                  <li>정규화(제목/링크/요약 등 정리)</li>
                  <li>중복 제거</li>
                  <li>점수(score) 계산 + 규칙 적용</li>
                  <li>카테고리별 상위 N개를 Inbox에 표시</li>
                </ol>
                <p>
                  즉, 규칙은 (4) 점수 계산/필터링 단계에서 적용되어 최종적으로 /fetch에서 보이는 Inbox 결과가 달라집니다.
                </p>
              </div>

              <div>
                <strong>2) 규칙의 종류(개념)</strong>
                <p>
                  ✅ 증가(Boost): 특정 키워드가 포함된 글의 점수를 올려서 더 잘 보이게 합니다.
                  예: CVE는 보안 이슈 가능성이 높으니 점수를 크게 올리기
                </p>
                <p>
                  🚫 무시(Mute): 특정 키워드가 포함된 글을 아예 제외합니다.
                  예: 채용, 이벤트는 노이즈가 많으니 수집 결과에서 제외
                </p>
                <p>Tip: “글이 너무 적게 뜬다”면 Mute 규칙이 너무 강할 수 있습니다.</p>
              </div>

              <div>
                <strong>3) 기본 규칙 세트(Noise / Security / Release)란?</strong>
                <p>처음 시작할 때 빠르게 세팅할 수 있도록 추천 규칙 묶음을 제공합니다.</p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Noise: 채용/이벤트/세미나 등 노이즈를 Mute하거나 가중치를 낮추는 규칙</li>
                  <li>Security: CVE, vulnerability, security 같은 보안 키워드를 Boost하는 규칙</li>
                  <li>Release: breaking, deprecated, EOL, migration 등 변경사항 키워드를 Boost하는 규칙</li>
                </ul>
                <p>
                  ✅ 추천 시작법: 처음에는 Noise + Security + Release를 모두 적용하고, Preview로 영향도를 확인하면서 필요 없는
                  규칙만 끄기(활성 토글)
                </p>
              </div>

              <div>
                <strong>4) 규칙 추가 방법(가장 중요한 부분)</strong>
                <p>상단 입력 영역에서 규칙을 직접 추가할 수 있습니다.</p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>유형: 현재는 주로 키워드를 사용합니다. (향후 도메인/소스 규칙 확장 가능)</li>
                  <li>동작: 증가(Boost) 또는 무시(Mute)를 선택</li>
                  <li>
                    가중치: Boost일 때 점수를 얼마나 올릴지 결정 (예: +2, +5). Mute는 보통 큰 숫자(예: 100).
                  </li>
                  <li>패턴: 찾고 싶은 키워드(예: CVE, deprecated, 채용)</li>
                </ul>
                <p>
                  추천 가중치 가이드: Boost(중요) +3 ~ +5 / Mute(제외) 100 (필터링 목적)
                </p>
              </div>

              <div>
                <strong>5) Preview(미리보기)는 무엇인가요?</strong>
                <p>
                  Preview는 규칙이 실제로 얼마나 많은 글에 영향을 주는지 미리 확인하는 기능입니다.
                  최근 7일(또는 14/30일) 기준으로 매칭 건수와 샘플을 보여줍니다.
                </p>
                <p>✅ 사용 팁: 패턴 입력 → Preview 확인 → 너무 많으면 더 구체적으로(예: CVE-)</p>
              </div>

              <div>
                <strong>6) 규칙 활성(ON/OFF) 토글 사용법</strong>
                <p>각 규칙 카드의 토글은 “삭제 없이 잠깐 끄기”입니다.</p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>✅ ON: 규칙 적용됨</li>
                  <li>⛔ OFF: 규칙 적용 안 됨(삭제 아님)</li>
                </ul>
              </div>

              <div>
                <strong>7) 규칙 삭제(주의)</strong>
                <p>규칙 카드의 삭제는 “완전 제거”입니다. 실험 중에는 삭제보다 토글 OFF를 추천합니다.</p>
              </div>

              <div>
                <strong>8) 자주 발생하는 상황별 추천 해결책</strong>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>수집 결과가 너무 적어요 → 기간 늘리기(7일→30일→180일), Mute 규칙 OFF</li>
                  <li>채용/이벤트가 너무 많아요 → Noise 세트 적용 또는 관련 키워드 Mute 추가</li>
                  <li>보안/릴리즈만 보고 싶어요 → Security + Release 세트 적용</li>
                </ul>
              </div>

              <div>
                <strong>9) 추천 초기 세팅(빠른 시작)</strong>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Noise + Security + Release 모두 적용</li>
                  <li>Preview로 “너무 많이 걸리는 규칙” 확인</li>
                  <li>필요 없는 규칙은 OFF로 유지</li>
                  <li>내 관심 키워드(예: Prisma, Next, Kubernetes)는 Boost로 +3 추가</li>
                </ol>
              </div>

              <div>
                <strong>마지막 한 줄</strong>
                <p>규칙 = 내 ‘관심사 필터’ + ‘우선순위 조절기’ 입니다. Preview로 안전하게 확인하면서, 필요한 만큼만 조정해 보세요.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="rules-quick">
        <div>
          <strong>기본 규칙 세트</strong>
          <div className="muted">이미 동일 패턴이 있으면 건너뜁니다.</div>
        </div>
        <div className="rules-quick-actions">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('추천 세팅(핵심 5개)만 추가할까요?')) {
                  applyRecommended();
                }
              }}
            >
              추천 세팅 적용(핵심)
            </button>
          {quickPresets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="secondary"
              onClick={() => {
                if (window.confirm(`${preset.label} 규칙을 추가할까요?`)) {
                  applyPreset(preset.key);
                }
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="input-grid" style={{ marginBottom: 16 }}>
        <label>
          유형
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="keyword">키워드</option>
            <option value="domain">도메인</option>
            <option value="source">소스</option>
          </select>
        </label>
        <label>
          동작
          <select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="boost">증가</option>
            <option value="mute">무시</option>
          </select>
        </label>
        <label>
          가중치
          <input
            type="number"
            min={1}
            max={100}
            value={weight}
            onChange={(event) => setWeight(Number(event.target.value))}
          />
        </label>
        <label>
          패턴
          <input
            type="text"
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder="예: CVE"
          />
        </label>
      </div>
      <button type="button" onClick={createRule}>
        규칙 추가
      </button>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Preview (최근 {previewDays}일)</strong>
          <select value={previewDays} onChange={(event) => setPreviewDays(Number(event.target.value))}>
            <option value={7}>7일</option>
            <option value={14}>14일</option>
            <option value={30}>30일</option>
          </select>
        </div>
        {previewLoading && <div className="muted">미리보기 계산 중...</div>}
        {previewMessage && <div className="notice">{previewMessage}</div>}
        {!previewLoading && previewCount !== null && (
          <div className="muted">
            최근 {previewDays}일 기준 매칭: {previewCount}건
            {previewImpact ? ` · ${previewImpact}` : ''}
            {previewTotal !== null && previewImpactRate !== null
              ? ` · 영향 비율 ${previewImpactRate}% (${previewTotal}건 중)`
              : ''}
          </div>
        )}
        {!previewLoading && previewTotal !== null && previewImpactRate !== null && (
          <div className="rule-impact">
            <div className="rule-impact-bar">
              <span style={{ width: `${Math.min(100, Math.max(0, previewImpactRate))}%` }} />
            </div>
            <div className="muted">영향도: {previewImpactRate}%</div>
          </div>
        )}
        {!previewLoading && previewCount === 0 && (
          <div className="muted">매칭되는 항목이 없습니다. 패턴이나 기간을 바꿔보세요.</div>
        )}
        {previewSamples.length > 0 && (
          <ul className="muted" style={{ marginTop: 8, paddingLeft: 18 }}>
            {previewSamples.map((sample) => (
              <li key={sample.id}>
                {sample.title} · {sample.sourceDomain} · {formatDate(sample.savedAt ?? sample.publishedAt)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="list" style={{ marginTop: 20 }}>
        {rules.length === 0 && <div className="muted">규칙이 없습니다.</div>}
        {rules.map((rule) => (
          <div key={rule.id} className={`card ${rule.enabled ? '' : 'rule-disabled'}`}>
            <div className="rule-row">
              <div>
                <strong>
                  {typeLabel[rule.type] ?? rule.type} · {actionLabel[rule.action] ?? rule.action}
                </strong>
                <div className="muted">패턴: {rule.pattern}</div>
                <div className="muted">가중치: {rule.weight}</div>
              </div>
              <div className="rule-actions">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                  />
                  <span className="toggle-track">
                    <span className="toggle-thumb" />
                  </span>
                  <span>{rule.enabled ? '활성' : '비활성'}</span>
                </label>
                <button type="button" className="secondary" onClick={() => deleteRule(rule.id)}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
