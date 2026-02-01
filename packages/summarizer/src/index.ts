import type { ContentType, Signal } from '@tech-radar/shared';
import { ContentTypeEnum, SignalsEnum } from '@tech-radar/shared';

const TEMPLATE_VERSION = 'free-v2';

const SIGNAL_KEYWORDS: Record<Signal, string[]> = {
  security: ['security', 'cve', 'vulnerability', 'patch', '보안', '취약', '취약점', '패치'],
  breaking: ['breaking', 'major', 'incompatible', 'migration', '호환', '중단', '파괴적'],
  deprecation: ['deprecated', 'removed', 'end of life', '지원 종료', '종료', '폐기', '삭제'],
  release: ['release', 'ga', 'announcement', '출시', '발표', '공개', '신규'],
  perf: ['performance', 'faster', 'optimization', '성능', '최적화', '개선'],
  migration: ['migration', 'migrate', 'upgrade', '업그레이드', '마이그레이션', '이관'],
  bugfix: ['bug fix', 'bugfix', 'fix', 'fixed', '버그', '수정'],
  tooling: ['tool', 'tooling', 'cli', 'sdk', 'plugin', '플러그인', '도구'],
  api: ['api', 'endpoint', 'rest', 'graphql', '스펙', '인터페이스']
};

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'your',
  'you',
  'are',
  'was',
  'were',
  'will',
  'about',
  'over',
  'when',
  'what',
  'why',
  'how',
  'http',
  'https',
  'www',
  'com',
  'blog',
  'news',
  'release',
  'notes',
  'update',
  'the',
  'of',
  'to',
  'in',
  'on',
  'a',
  'an',
  'and',
  'or',
  'is',
  'are',
  'be',
  'as',
  'at',
  'by',
  'with',
  'for',
  'it',
  'we',
  'our',
  'us',
  '이번',
  '관련',
  '내용',
  '정리',
  '소개',
  '기술',
  '블로그',
  '포스트',
  '자료',
  '그리고',
  '하지만',
  '또한',
  '관련된',
  '등'
]);

const COMPANY_DOMAIN_ALLOWLIST = [
  'toss.tech',
  'techblog.woowahan.com',
  'd2.naver.com',
  'helloworld.kurly.com',
  'tech.kakaoenterprise.com',
  'tech.devsisters.com',
  'tech.socarcorp.kr',
  'techblog.yogiyo.co.kr',
  'hyperconnect.github.io',
  'jojoldu.tistory.com',
  'javacan.tistory.com',
  'cheese10yun.github.io',
  'medium.com'
];

const NEWS_SOURCES = ['geeknews', 'news', 'hada'];

const TECH_HINTS = [
  'Next.js',
  'React',
  'Vue',
  'Svelte',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'Kubernetes',
  'Docker',
  'PostgreSQL',
  'Redis',
  'Kafka',
  'Terraform',
  'AWS',
  'GCP',
  'Azure',
  'GraphQL',
  'REST',
  'OpenAI',
  'LLM',
  'Fastify',
  'Next',
  'Prisma'
];

function normalizeText(input: string): string {
  return input.toLowerCase();
}

function sentenceSplit(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function toTokenCandidates(text: string): string[] {
  const cleaned = text.replace(/[^a-zA-Z0-9가-힣.+-]+/g, ' ');
  const basic = cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const uppercase = Array.from(text.matchAll(/[A-Z][A-Za-z0-9.+-]{1,}/g)).map((match) => match[0]);

  return [...basic, ...uppercase];
}

export function extractKeywords(text: string, limit = 5): string[] {
  const tokens = toTokenCandidates(text)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOPWORDS.has(token));

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);

  return sorted;
}

export function detectSignals(text: string): Signal[] {
  const normalized = normalizeText(text);
  const hits: Signal[] = [];

  for (const signal of SignalsEnum.options) {
    const keywords = SIGNAL_KEYWORDS[signal];
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      hits.push(signal);
    }
  }

  return hits;
}

export type DetectContentTypeInput = {
  title: string;
  url: string;
  snippet?: string | null;
  sourceName?: string | null;
  sourceTags?: string[] | null;
  raw?: unknown;
};

export function detectContentType(input: DetectContentTypeInput): ContentType {
  const title = input.title ?? '';
  const snippet = input.snippet ?? '';
  const url = input.url ?? '';
  const sourceName = input.sourceName ?? '';
  const tags = input.sourceTags ?? [];

  const normalizedUrl = url.toLowerCase();
  const normalizedTitle = title.toLowerCase();
  const normalizedSnippet = snippet.toLowerCase();
  const normalizedSource = sourceName.toLowerCase();
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));

  const releaseSignals =
    /release|releases|changelog|advisory|security|tag|version/.test(normalizedUrl) ||
    /release|changelog|breaking changes|v\d+\.|version/.test(normalizedTitle) ||
    /release|changelog|breaking changes|v\d+\.|version/.test(normalizedSnippet) ||
    /github\.com\/[^/]+\/[^/]+\/(releases|tags)\//.test(normalizedUrl);

  if (releaseSignals) return 'RELEASE_NOTE';

  const companySignals =
    tagSet.has('company') ||
    COMPANY_DOMAIN_ALLOWLIST.some((domain) => normalizedUrl.includes(domain)) ||
    ['toss', '우아한', 'naver', 'kakao', '쿠팡', '당근', '뱅크샐러드'].some((keyword) =>
      normalizedSource.includes(keyword)
    );

  if (companySignals) return 'COMPANY_BLOG';

  const newsSignals =
    tagSet.has('news') ||
    NEWS_SOURCES.some((keyword) => normalizedSource.includes(keyword)) ||
    /^\[[^\]]+\]/.test(title) ||
    (snippet.length > 0 && snippet.length < 120);

  if (newsSignals) return 'NEWS';

  return 'OTHER';
}

function detectVersion(text: string): string | null {
  const match = text.match(/v?\d+\.\d+(?:\.\d+)?/i);
  return match ? match[0] : null;
}

function detectChangeType(version: string | null, signals: Signal[]): 'major' | 'minor' | 'patch' | 'unknown' {
  if (signals.includes('breaking')) return 'major';
  if (!version) return 'unknown';
  const normalized = version.replace(/^v/i, '');
  const parts = normalized.split('.').map((part) => Number(part));
  if (parts.length >= 3) {
    const [major = 0, minor = 0, patch = 0] = parts;
    if (major > 0 && minor === 0 && patch === 0) return 'major';
    if (patch > 0) return 'patch';
    if (minor > 0) return 'minor';
  }
  if (parts.length === 2) {
    const [major = 0, minor = 0] = parts;
    if (major > 0 && minor === 0) return 'major';
    if (minor > 0) return 'minor';
  }
  return 'unknown';
}

function extractStackHints(text: string): string[] {
  const normalized = text.toLowerCase();
  const hints = TECH_HINTS.filter((hint) => normalized.includes(hint.toLowerCase()));
  return Array.from(new Set(hints));
}

function normalizeTag(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const hasAscii = /[a-zA-Z]/.test(trimmed);
  let tag = hasAscii ? trimmed.toLowerCase() : trimmed;
  tag = tag.replace(/\s+/g, '-');
  tag = tag.replace(/[^a-z0-9가-힣._-]+/gi, '');
  return tag;
}

function buildSuggestedTags(options: {
  keywords?: string[];
  stackHints?: string[];
  signals?: Signal[];
  versionDetected?: string | null;
  extra?: string[];
}): string[] {
  const collected = [
    ...(options.stackHints ?? []),
    ...(options.keywords ?? []),
    ...(options.signals ?? []),
    ...(options.versionDetected ? [options.versionDetected] : []),
    ...(options.extra ?? [])
  ];

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of collected) {
    const tag = normalizeTag(String(raw));
    if (!tag) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags.slice(0, 8);
}

function buildWhyItMatters(signals: Signal[], keywords: string[]): string {
  if (signals.includes('security')) {
    return '보안 이슈가 포함되어 있어 빠른 검토와 패치 계획이 필요합니다.';
  }
  if (signals.includes('breaking')) {
    return '호환성에 영향이 있을 수 있어 마이그레이션 검토가 필요합니다.';
  }
  if (signals.includes('deprecation')) {
    return '지원 종료 항목이 포함되어 대체 방안을 준비해야 합니다.';
  }
  if (signals.includes('release')) {
    return '새 릴리즈로 기능 또는 품질 개선이 예상됩니다.';
  }
  if (signals.includes('perf')) {
    return '성능 개선 내용이 포함되어 영향 범위 점검이 필요합니다.';
  }

  const keywordHint = keywords.find((keyword) => ['운영', '성능', '비용', '안정', '장애'].includes(keyword));
  if (keywordHint) {
    return `${keywordHint} 관점에서 참고할 만한 내용이 있습니다.`;
  }

  return '핵심 내용을 빠르게 확인해 필요한 적용 여부를 판단하세요.';
}

function summarizeNews(input: SummarizeInput, signals: Signal[]): SummaryOutput {
  const snippet = input.snippet?.trim() ?? '';
  const sentences = sentenceSplit(snippet);
  const tldrBase = sentences.length >= 2 ? sentences.slice(0, 2).join(' ') : snippet || input.title;
  const tldr = truncate(tldrBase, 250);

  const keywords = extractKeywords(`${input.title} ${snippet}`);
  const whyItMatters = buildWhyItMatters(signals, keywords);
  const suggestedTags = buildSuggestedTags({ keywords, signals });
  const points = [
    truncate(`변경점: ${input.title}${snippet ? ` - ${snippet}` : ''}`, 160),
    `중요성: ${whyItMatters}`,
    `읽기 포인트: ${keywords.length ? keywords.join(', ') : '핵심 키워드 확인'}`
  ];

  const wordCount = toTokenCandidates(snippet).length;
  const readingTimeSec = Math.max(30, Math.ceil(wordCount / 3.3));

  return {
    contentType: 'NEWS',
    summaryTemplateVersion: TEMPLATE_VERSION,
    summaryTldr: tldr,
    summaryPoints: points,
    signals,
    whyItMatters,
    summaryMeta: {
      keywords,
      readingTimeSec,
      suggestedTags
    }
  };
}

function extractStructuredPoints(snippet: string): string[] {
  const lines = snippet.split(/\n|\r/).map((line) => line.trim()).filter(Boolean);
  const candidates = lines.filter((line) => /^[•\-\*]/.test(line) || /:/.test(line));
  if (candidates.length > 0) {
    return candidates.map((line) => line.replace(/^[•\-\*]\s*/, '')).slice(0, 5);
  }
  return [];
}

function summarizeCompanyBlog(input: SummarizeInput, signals: Signal[]): SummaryOutput {
  const snippet = input.snippet?.trim() ?? '';
  const structuredPoints = extractStructuredPoints(snippet);
  const sentences = sentenceSplit(snippet);
  const pointsBase = structuredPoints.length > 0 ? structuredPoints : sentences;
  const points = pointsBase.slice(0, 5);

  while (points.length < 3) {
    const keywords = extractKeywords(`${input.title} ${snippet}`, 3);
    if (!keywords.length) break;
    points.push(`핵심 키워드: ${keywords.join(', ')}`);
  }

  const tldrBase = sentences.length >= 3 ? sentences.slice(0, 3).join(' ') : snippet || input.title;
  const tldr = truncate(tldrBase, 350);

  const keywords = extractKeywords(`${input.title} ${snippet}`);
  const whyItMatters = buildWhyItMatters(signals, keywords);
  const stackHints = extractStackHints(`${input.title} ${snippet}`);
  const suggestedTags = buildSuggestedTags({ keywords, stackHints, signals });

  const takeaways = points.filter((point) => /했다|했습니다|적용|개선|도입|구축|we |introduced|implemented/i.test(point));

  return {
    contentType: 'COMPANY_BLOG',
    summaryTemplateVersion: TEMPLATE_VERSION,
    summaryTldr: tldr,
    summaryPoints: points.slice(0, 5),
    signals,
    whyItMatters,
    summaryMeta: {
      takeaways: takeaways.slice(0, 3),
      stackHints,
      suggestedTags
    }
  };
}

function extractReleaseSections(text: string): string[] {
  const lines = text.split(/\n|\r/).map((line) => line.trim()).filter(Boolean);
  const labels = [
    { label: 'Breaking Changes', regex: /breaking changes|breaking/i },
    { label: 'Security', regex: /security|보안/i },
    { label: 'Deprecated', regex: /deprecated|deprecation|지원 종료|폐기/i },
    { label: 'Migration', regex: /migration|migrate|마이그레이션|이관/i },
    { label: 'Bug Fixes', regex: /bug fix|bugfix|fixed|수정/i }
  ];

  const results: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const label = labels.find((entry) => entry.regex.test(line));
    if (!label) continue;

    const nextLines = lines.slice(i + 1, i + 3);
    nextLines.forEach((next) => {
      if (!next) return;
      results.push(`${label.label}: ${next.replace(/^[•\-\*]\s*/, '')}`);
    });
  }

  return results;
}

function summarizeReleaseNote(input: SummarizeInput, signals: Signal[]): SummaryOutput {
  const snippet = input.snippet?.trim() ?? '';
  const raw = input.rawText ?? '';
  const combined = `${input.title}\n${snippet}\n${raw}`;

  const versionDetected = detectVersion(combined) ?? detectVersion(input.url);
  const changeType = detectChangeType(versionDetected, signals);

  const sectionPoints = extractReleaseSections(raw || snippet);
  const sentences = sentenceSplit(snippet);
  const points = (sectionPoints.length > 0 ? sectionPoints : sentences).slice(0, 5);

  const migrationNotes = sentences.filter((sentence) => /migration|migrate|업그레이드|호환|마이그레이션/i.test(sentence));

  const actionHint = signals.some((signal) => ['security', 'breaking', 'deprecation', 'migration'].includes(signal))
    ? 'update-now'
    : signals.includes('release')
      ? 'monitor'
      : 'ignore';

  const tldrCore = versionDetected ? `버전 ${versionDetected}` : '릴리즈 업데이트';
  const tldr = truncate(`${tldrCore} (${changeType}). ${sentences[0] ?? input.title}`, 250);
  const keywords = extractKeywords(`${input.title} ${snippet}`);
  const whyItMatters = buildWhyItMatters(signals, keywords);
  const suggestedTags = buildSuggestedTags({ keywords, signals, versionDetected });

  return {
    contentType: 'RELEASE_NOTE',
    summaryTemplateVersion: TEMPLATE_VERSION,
    summaryTldr: tldr,
    summaryPoints: points,
    signals,
    whyItMatters,
    summaryMeta: {
      versionDetected,
      changeType,
      migrationNotes: migrationNotes.slice(0, 3),
      actionHint,
      suggestedTags
    }
  };
}

function summarizeOther(input: SummarizeInput, signals: Signal[]): SummaryOutput {
  const snippet = input.snippet?.trim() ?? '';
  const sentences = sentenceSplit(snippet);
  const tldrBase = sentences.length >= 2 ? sentences.slice(0, 2).join(' ') : snippet || input.title;
  const tldr = truncate(tldrBase, 250);

  const points = sentences.slice(0, 3);
  const keywords = extractKeywords(`${input.title} ${snippet}`);
  const suggestedTags = buildSuggestedTags({ keywords, signals });

  while (points.length < 3) {
    if (keywords.length === 0) break;
    points.push(`키워드: ${keywords.join(', ')}`);
    break;
  }

  return {
    contentType: 'OTHER',
    summaryTemplateVersion: TEMPLATE_VERSION,
    summaryTldr: tldr,
    summaryPoints: points,
    signals,
    whyItMatters: buildWhyItMatters(signals, keywords),
    summaryMeta: {
      keywords,
      suggestedTags
    }
  };
}

export type SummarizeInput = {
  title: string;
  url: string;
  snippet?: string | null;
  rawText?: string | null;
  sourceName?: string | null;
  sourceTags?: string[] | null;
  contentType?: ContentType;
};

export type SummaryOutput = {
  contentType: ContentType;
  summaryTemplateVersion: string;
  summaryTldr: string;
  summaryPoints: string[];
  signals: Signal[];
  whyItMatters: string;
  summaryMeta: Record<string, unknown>;
};

export function summarize(input: SummarizeInput): SummaryOutput {
  const contentType = input.contentType ??
    detectContentType({
      title: input.title,
      url: input.url,
      snippet: input.snippet,
      sourceName: input.sourceName,
      sourceTags: input.sourceTags
    });

  const textForSignals = [input.title, input.snippet, input.rawText].filter(Boolean).join(' ');
  const signals = detectSignals(textForSignals);

  if (contentType === 'RELEASE_NOTE') return summarizeReleaseNote(input, signals);
  if (contentType === 'COMPANY_BLOG') return summarizeCompanyBlog(input, signals);
  if (contentType === 'NEWS') return summarizeNews(input, signals);
  return summarizeOther(input, signals);
}

export { TEMPLATE_VERSION };
