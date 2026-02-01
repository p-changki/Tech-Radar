export const CATEGORIES = ['AI', 'FE', 'BE', 'DEVOPS', 'DATA', 'SECURITY', 'OTHER'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  AI: 'AI',
  FE: 'FE',
  BE: 'BE',
  DEVOPS: 'DEVOPS',
  DATA: '데이터',
  SECURITY: '보안',
  OTHER: '기타'
};

export const CONTENT_TYPES = ['RELEASE_NOTE', 'COMPANY_BLOG', 'NEWS', 'OTHER'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const SIGNALS = [
  'security',
  'breaking',
  'deprecation',
  'release',
  'perf',
  'migration',
  'bugfix',
  'tooling',
  'api'
] as const;
export type SignalType = (typeof SIGNALS)[number];

export const STATUSES = ['inbox', 'reading', 'saved', 'apply', 'done', 'muted'] as const;
export type StatusType = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<StatusType, string> = {
  inbox: '인박스',
  reading: '읽는 중',
  saved: '저장됨',
  apply: '적용 예정',
  done: '완료',
  muted: '제외'
};

export const LOOKBACK_OPTIONS = [
  { label: '전체', value: 'all' },
  { label: '1일', value: '1' },
  { label: '7일', value: '7' },
  { label: '30일', value: '30' },
  { label: '180일', value: '180' }
] as const;
