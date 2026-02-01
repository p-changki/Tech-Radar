'use client';

import { useEffect, useState } from 'react';
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
  const [message, setMessage] = useState<string | null>(null);
  const typeLabel: Record<string, string> = {
    keyword: '키워드',
    domain: '도메인',
    source: '소스'
  };
  const actionLabel: Record<string, string> = {
    boost: '증가',
    mute: '무시'
  };

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

  return (
    <section className="section">
      <h2>규칙</h2>
      {message && <div className="notice">{message}</div>}
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

      <div className="list" style={{ marginTop: 20 }}>
        {rules.length === 0 && <div className="muted">규칙이 없습니다.</div>}
        {rules.map((rule) => (
          <div key={rule.id} className="card">
            <strong>
              {typeLabel[rule.type] ?? rule.type} · {actionLabel[rule.action] ?? rule.action}
            </strong>
            <div className="muted">패턴: {rule.pattern}</div>
            <div className="muted">가중치: {rule.weight}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
