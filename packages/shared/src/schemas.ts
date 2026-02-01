import { z } from 'zod';

export const CategoryEnum = z.enum(['AI', 'FE', 'BE', 'DEVOPS', 'DATA', 'SECURITY', 'OTHER']);
export type Category = z.infer<typeof CategoryEnum>;

export const LocaleEnum = z.enum(['ko', 'en']);
export type Locale = z.infer<typeof LocaleEnum>;

export const FetchLocaleEnum = z.enum(['ko', 'en', 'all']);
export type FetchLocale = z.infer<typeof FetchLocaleEnum>;

export const FetchModeEnum = z.enum(['real', 'dummy']);
export type FetchMode = z.infer<typeof FetchModeEnum>;

export const SignalsEnum = z.enum([
  'security',
  'breaking',
  'deprecation',
  'release',
  'perf',
  'migration',
  'bugfix',
  'tooling',
  'api'
]);
export type Signal = z.infer<typeof SignalsEnum>;

export const ContentTypeEnum = z.enum(['RELEASE_NOTE', 'COMPANY_BLOG', 'NEWS', 'OTHER']);
export type ContentType = z.infer<typeof ContentTypeEnum>;

export const SourceTypeEnum = z.enum(['rss', 'github', 'npm', 'pypi']);
export const RuleTypeEnum = z.enum(['domain', 'keyword', 'source']);
export const RuleActionEnum = z.enum(['mute', 'boost']);

const LimitSchema = z.number().int().min(0).max(5);
const LookbackDaysSchema = z.number().int().min(1).max(180);

export const FetchRunParamsSchema = z
  .object({
    mode: FetchModeEnum.optional(),
    locale: FetchLocaleEnum.optional(),
    presetId: z.string().min(1).optional(),
    sourceIds: z.array(z.string().min(1)).optional(),
    async: z.boolean().optional(),
    lookbackDays: LookbackDaysSchema.optional(),
    htmlFallback: z.boolean().optional(),
    includeSeen: z.boolean().optional(),
    limits: z
      .object({
        AI: LimitSchema.optional(),
        FE: LimitSchema.optional(),
        BE: LimitSchema.optional(),
        DEVOPS: LimitSchema.optional(),
        DATA: LimitSchema.optional(),
        SECURITY: LimitSchema.optional(),
        OTHER: LimitSchema.optional()
      })
      .optional()
  })
  .default({});

export type FetchRunParams = z.infer<typeof FetchRunParamsSchema>;

export type FetchRunLimits = Record<Category, number>;

export const DEFAULT_LIMITS: FetchRunLimits = {
  AI: 0,
  FE: 0,
  BE: 0,
  DEVOPS: 0,
  DATA: 0,
  SECURITY: 0,
  OTHER: 0
};

export function normalizeFetchRunParams(
  params?: FetchRunParams
): {
  limits: FetchRunLimits;
  mode: FetchMode;
  locale: FetchLocale;
  presetId?: string;
  sourceIds?: string[];
  lookbackDays?: number;
  htmlFallback?: boolean;
  includeSeen?: boolean;
  async: boolean;
} {
  const limits = params?.limits ?? {};
  return {
    limits: {
      AI: limits.AI ?? DEFAULT_LIMITS.AI,
      FE: limits.FE ?? DEFAULT_LIMITS.FE,
      BE: limits.BE ?? DEFAULT_LIMITS.BE,
      DEVOPS: limits.DEVOPS ?? DEFAULT_LIMITS.DEVOPS,
      DATA: limits.DATA ?? DEFAULT_LIMITS.DATA,
      SECURITY: limits.SECURITY ?? DEFAULT_LIMITS.SECURITY,
      OTHER: limits.OTHER ?? DEFAULT_LIMITS.OTHER
    },
    mode: params?.mode ?? 'real',
    locale: params?.locale ?? 'all',
    presetId: params?.presetId,
    sourceIds: params?.sourceIds,
    lookbackDays: params?.lookbackDays,
    htmlFallback: params?.htmlFallback,
    includeSeen: params?.includeSeen ?? false,
    async: params?.async ?? true
  };
}

export const SourceSchema = z.object({
  id: z.string(),
  type: SourceTypeEnum,
  name: z.string(),
  key: z.string(),
  categoryDefault: CategoryEnum,
  weight: z.number(),
  enabled: z.boolean(),
  locale: z.string(),
  tags: z.unknown().optional(),
  etag: z.string().nullable().optional(),
  lastModified: z.string().nullable().optional(),
  lastFetchedAt: z.coerce.date().nullable().optional(),
  lastStatus: z.number().nullable().optional(),
  lastError: z.string().nullable().optional(),
  consecutiveFailures: z.number().optional()
});
export type SourceDTO = z.infer<typeof SourceSchema>;

export const RuleSchema = z.object({
  id: z.string(),
  type: RuleTypeEnum,
  pattern: z.string(),
  action: RuleActionEnum,
  weight: z.number(),
  enabled: z.boolean()
});
export type RuleDTO = z.infer<typeof RuleSchema>;

export const FetchedItemSchema = z.object({
  id: z.string().optional(),
  runId: z.string().optional(),
  category: CategoryEnum,
  sourceId: z.string().nullable().optional(),
  title: z.string(),
  url: z.string().url(),
  publishedAt: z.coerce.date(),
  snippet: z.string().nullable().optional(),
  contentTypeHint: ContentTypeEnum.optional(),
  signals: z.array(SignalsEnum).default([]),
  score: z.number().optional(),
  raw: z.unknown().optional()
});
export type FetchedItemDTO = z.infer<typeof FetchedItemSchema>;

export const PostSchema = z.object({
  id: z.string().optional(),
  category: CategoryEnum,
  sourceId: z.string().nullable().optional(),
  contentType: ContentTypeEnum.optional(),
  summaryTemplateVersion: z.string().optional(),
  title: z.string(),
  url: z.string().url(),
  publishedAt: z.coerce.date(),
  summaryTldr: z.string(),
  summaryPoints: z.array(z.string()),
  signals: z.array(SignalsEnum),
  whyItMatters: z.string(),
  summaryMeta: z.unknown().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  savedAt: z.coerce.date().optional(),
  rawSnapshot: z.unknown().optional()
});
export type PostDTO = z.infer<typeof PostSchema>;

export const PresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isDefault: z.boolean().optional()
});
export type PresetDTO = z.infer<typeof PresetSchema>;

export const FetchRunStatusSchema = z.object({
  runId: z.string(),
  status: z.enum(['running', 'success', 'failed']),
  error: z.string().nullable().optional(),
  counts: z
    .object({
      totalFetched: z.number().optional(),
      totalStored: z.number().optional(),
      sourceSuccess: z.number().optional(),
      sourceNotModified: z.number().optional(),
      sourceFailures: z.number().optional()
    })
    .optional(),
  sources: z
    .array(
      z.object({
        sourceId: z.string(),
        name: z.string(),
        status: z.number(),
        fetchedCount: z.number(),
        error: z.string().optional()
      })
    )
    .optional()
});
export type FetchRunStatusDTO = z.infer<typeof FetchRunStatusSchema>;
