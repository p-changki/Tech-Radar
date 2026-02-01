import type { Category } from '@tech-radar/shared';

export type Source = {
  id: string;
  name: string;
  key: string;
  categoryDefault: Category;
  locale: string;
  enabled: boolean;
  tags?: string[];
  weight?: number | null;
  consecutiveFailures?: number;
  lastError?: string | null;
  lastStatus?: number | null;
  lastFetchedAt?: string | null;
};

export type Preset = {
  id: string;
  name: string;
  sourceCount?: number;
  isDefault?: boolean;
};

