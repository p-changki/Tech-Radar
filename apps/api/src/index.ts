import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastify from 'fastify';
import { ZodError, z } from 'zod';
import { prisma, Prisma } from '@tech-radar/db';
import {
  CategoryEnum,
  ContentTypeEnum,
  FetchLocaleEnum,
  FetchRunParamsSchema,
  RuleActionEnum,
  RuleTypeEnum,
  ExportPresetV1Schema,
  ImportPresetOptionsSchema,
  buildOpml,
  parseOpml,
  canonicalizeUrl,
  normalizeFetchRunParams,
  type ContentType,
  type Category
} from '@tech-radar/shared';
import { summarize } from '@tech-radar/summarizer';

const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
loadEnv({ path: envPath });

const app = fastify({ logger: true });

const FEED_TYPES = ['application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml', 'application/feed+xml'];

const isFeedContentType = (value?: string | null) => {
  if (!value) return false;
  return FEED_TYPES.some((type) => value.toLowerCase().includes(type));
};

const bodyLooksLikeFeed = (text: string) => /<rss\b|<feed\b|<rdf:RDF\b/i.test(text);

const fetchWithTimeout = async (url: string, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'tech-radar/0.1' } });
  } finally {
    clearTimeout(timeout);
  }
};

const extractFeedLinks = (html: string, baseUrl: string) => {
  const links = html.match(/<link\s+[^>]*>/gi) ?? [];
  const results: string[] = [];
  for (const link of links) {
    const attrs: Record<string, string> = {};
    const attrMatches = link.match(/(\w+)\s*=\s*(['"])(.*?)\2/g) ?? [];
    for (const attr of attrMatches) {
      const [, key, , value] = attr.match(/(\w+)\s*=\s*(['"])(.*?)\2/) ?? [];
      if (key && value) attrs[key.toLowerCase()] = value;
    }
    const rel = attrs.rel?.toLowerCase() ?? '';
    const type = attrs.type?.toLowerCase() ?? '';
    const href = attrs.href;
    if (!href) continue;
    if (!rel.includes('alternate')) continue;
    if (!type.includes('rss') && !type.includes('atom') && !type.includes('xml')) continue;
    try {
      results.push(new URL(href, baseUrl).toString());
    } catch {
      // ignore invalid urls
    }
  }
  return Array.from(new Set(results));
};

const buildFeedGuesses = (inputUrl: string) => {
  const url = new URL(inputUrl);
  const origin = url.origin;
  const path = url.pathname.endsWith('/') ? url.pathname : url.pathname.replace(/\/[^/]*$/, '/');
  const candidates = new Set<string>();
  const suffixes = ['feed', 'feed.xml', 'rss', 'rss.xml', 'atom.xml', 'index.xml'];
  for (const suffix of suffixes) {
    candidates.add(`${origin}/${suffix}`);
    candidates.add(`${origin}${path}${suffix}`);
  }
  return Array.from(candidates);
};

const buildQueryFeedGuesses = (inputUrl: string) => {
  const url = new URL(inputUrl);
  const candidates = new Set<string>();
  if (url.search) {
    const withFeedRss2 = new URL(inputUrl);
    if (!withFeedRss2.searchParams.has('feed')) {
      withFeedRss2.searchParams.set('feed', 'rss2');
      candidates.add(withFeedRss2.toString());
      const withFeedRss = new URL(inputUrl);
      withFeedRss.searchParams.set('feed', 'rss');
      candidates.add(withFeedRss.toString());
    }
    const feedPath = new URL(inputUrl);
    feedPath.pathname = feedPath.pathname.endsWith('/') ? `${feedPath.pathname}feed/` : `${feedPath.pathname}/feed/`;
    candidates.add(feedPath.toString());
  }
  return Array.from(candidates);
};

const discoverFeeds = async (inputUrl: string) => {
  const response = await fetchWithTimeout(inputUrl);
  const finalUrl = response.url || inputUrl;
  const contentType = response.headers.get('content-type');
  const text = await response.text();

  if (isFeedContentType(contentType) && bodyLooksLikeFeed(text)) {
    return { feeds: [finalUrl], finalUrl };
  }

  const discovered = extractFeedLinks(text, finalUrl);
  if (discovered.length > 0) {
    return { feeds: discovered, finalUrl };
  }

  const guesses = Array.from(new Set([...buildFeedGuesses(finalUrl), ...buildQueryFeedGuesses(finalUrl)])).slice(0, 12);
  const found: string[] = [];
  for (const candidate of guesses) {
    try {
      const feedRes = await fetchWithTimeout(candidate, 6000);
      const feedType = feedRes.headers.get('content-type');
      const feedText = await feedRes.text();
      if (isFeedContentType(feedType) && bodyLooksLikeFeed(feedText)) {
        found.push(feedRes.url || candidate);
      }
    } catch {
      // ignore failures
    }
  }

  return { feeds: Array.from(new Set(found)), finalUrl };
};

await app.register(cors, {
  origin: ['http://localhost:3002'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
});
await app.register(multipart);

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'ValidationError',
      issues: error.issues
    });
  }

  const err = error instanceof Error ? error : new Error('Unknown error');
  const prismaCode = (error as { code?: string }).code;
  if (prismaCode === 'P2002') {
    return reply.status(409).send({
      error: 'UniqueConstraintError',
      message: err.message
    });
  }

  request.log.error(error);
  return reply.status(500).send({
    error: 'ServerError',
    message: err.message
  });
});

app.get('/health', async () => ({ ok: true }));

app.post('/v1/fetch/run', async (request) => {
  const body = FetchRunParamsSchema.parse(request.body ?? {});
  const normalized = normalizeFetchRunParams(body);

  const sourceIds = normalized.sourceIds?.slice(0, 50);

  const run = await prisma.fetchRun.create({
    data: {
      status: 'running',
      params: {
        ...normalized,
        sourceIds
      }
    }
  });

  await prisma.fetchJob.create({
    data: {
      runId: run.id,
      status: 'queued'
    }
  });

  return { runId: run.id };
});

app.get('/v1/fetch/run/:runId', async (request, reply) => {
  const paramsSchema = z.object({ runId: z.string().min(1) });
  const { runId } = paramsSchema.parse(request.params);

  const run = await prisma.fetchRun.findUnique({
    where: { id: runId }
  });

  if (!run) {
    return reply.status(404).send({ error: 'NotFound', message: 'run not found' });
  }

  const result = run.result as
    | {
        sources?: Array<{ sourceId: string; name: string; status: number; fetchedCount: number; error?: string }>;
        counts?: Record<string, number>;
      }
    | undefined;

    return {
      runId: run.id,
      status: run.status,
      counts: result?.counts,
      sources: result?.sources,
      error: run.error
    };
  });

app.get('/v1/inbox', async (request) => {
  const querySchema = z.object({
    runId: z.string().min(1),
    includeSeen: z.enum(['true', 'false']).optional()
  });
  const { runId, includeSeen } = querySchema.parse(request.query);

  const items = await prisma.fetchedItem.findMany({
    where: { runId },
    orderBy: { publishedAt: 'desc' },
    include: { source: true }
  });

  const toResponseItem = (item: typeof items[number]) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    category: item.category,
    snippet: item.snippet,
    contentTypeHint: item.contentTypeHint,
    signals: item.signals ?? [],
    publishedAt: item.publishedAt,
    sourceId: item.sourceId,
    sourceName: item.source?.name ?? null
  });

  if (includeSeen !== 'true') {
    return { items: items.map(toResponseItem) };
  }

  const run = await prisma.fetchRun.findUnique({
    where: { id: runId },
    select: { result: true }
  });
  const seenItemIds = Array.isArray((run?.result as { seenItemIds?: unknown })?.seenItemIds)
    ? ((run?.result as { seenItemIds?: unknown })?.seenItemIds as string[])
    : [];

  if (seenItemIds.length === 0) {
    return { items };
  }

  const seenItems = await prisma.fetchedItem.findMany({
    where: { id: { in: seenItemIds } },
    include: { source: true }
  });

  const merged = new Map<string, (typeof items)[number]>();
  for (const item of items) merged.set(item.id, item);
  for (const item of seenItems) merged.set(item.id, item);

  const mergedItems = Array.from(merged.values()).sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );

  return { items: mergedItems.map(toResponseItem) };
});

app.post('/v1/posts', async (request) => {
  const bodySchema = z.object({ fetchedItemIds: z.array(z.string().min(1)).min(1) });
  const { fetchedItemIds } = bodySchema.parse(request.body);

  const items = await prisma.fetchedItem.findMany({
    where: { id: { in: fetchedItemIds } }
  });

  if (items.length === 0) {
    return { posts: [] };
  }

  const sourceIds = Array.from(new Set(items.map((item) => item.sourceId).filter(Boolean))) as string[];
  const sources = sourceIds.length
    ? await prisma.source.findMany({ where: { id: { in: sourceIds } } })
    : [];
  const sourceMap = new Map(sources.map((source) => [source.id, source]));

  await prisma.$transaction(
    items.map((item) => {
      const source = item.sourceId ? sourceMap.get(item.sourceId) ?? null : null;
      const hint = item.contentTypeHint
        ? ContentTypeEnum.safeParse(item.contentTypeHint)
        : null;
      const summary = summarize({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        rawText: item.raw ? JSON.stringify(item.raw) : null,
        sourceName: source?.name ?? null,
        sourceTags: Array.isArray(source?.tags) ? (source?.tags as string[]) : null,
        contentType: hint?.success ? hint.data : undefined
      });

      const rawSnapshot = item.raw && typeof item.raw === 'object' && !Array.isArray(item.raw)
        ? (item.raw as Record<string, unknown>)
        : {};

      return prisma.post.upsert({
        where: { url: item.url },
        update: {
          savedAt: new Date()
        },
        create: {
          category: item.category,
          sourceId: item.sourceId ?? null,
          contentType: summary.contentType,
          summaryTemplateVersion: summary.summaryTemplateVersion,
          title: item.title,
          url: item.url,
          publishedAt: item.publishedAt,
          summaryTldr: summary.summaryTldr,
          summaryPoints: summary.summaryPoints,
          signals: summary.signals,
          whyItMatters: summary.whyItMatters,
          summaryMeta: summary.summaryMeta as Prisma.InputJsonValue,
          tags: [],
          notes: null,
      rawSnapshot: {
        sourceKey: typeof rawSnapshot.sourceKey === 'string' ? rawSnapshot.sourceKey : source?.key ?? null,
        originalLink: typeof rawSnapshot.originalLink === 'string' ? rawSnapshot.originalLink : item.url,
        guid: typeof rawSnapshot.guid === 'string' ? rawSnapshot.guid : null,
        fetchedAt: new Date().toISOString(),
        contentTypeHint: item.contentTypeHint ?? null,
        title: item.title,
        url: item.url,
        snippet: item.snippet ?? null,
        sourceName: source?.name ?? null,
        sourceTags: Array.isArray(source?.tags) ? source?.tags : null
      } as Prisma.InputJsonValue
    }
  });
    })
  );

  const posts = await prisma.post.findMany({ orderBy: { savedAt: 'desc' } });
  return { posts };
});

app.get('/v1/posts', async () => {
  const posts = await prisma.post.findMany({ orderBy: { savedAt: 'desc' } });
  return { posts };
});

app.delete('/v1/posts', async (request) => {
  const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1) });
  const { ids } = bodySchema.parse(request.body);

  const result = await prisma.post.deleteMany({
    where: { id: { in: ids } }
  });

  return { deletedCount: result.count };
});

app.get('/v1/posts/:id', async (request, reply) => {
  const paramsSchema = z.object({ id: z.string().min(1) });
  const { id } = paramsSchema.parse(request.params);

  const post = await prisma.post.findUnique({
    where: { id },
    include: { source: true }
  });

  if (!post) {
    return reply.status(404).send({ error: 'NotFound', message: 'post not found' });
  }

  return { post };
});

app.patch('/v1/posts/:id', async (request, reply) => {
  const paramsSchema = z.object({ id: z.string().min(1) });
  const querySchema = z.object({ regenerateSummary: z.string().optional() });
  const bodySchema = z.object({
    contentType: ContentTypeEnum.optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().nullable().optional()
  });

  const { id } = paramsSchema.parse(request.params);
  const { regenerateSummary } = querySchema.parse(request.query);
  const body = bodySchema.parse(request.body);

  const post = await prisma.post.findUnique({ where: { id }, include: { source: true } });
  if (!post) {
    return reply.status(404).send({ error: 'NotFound', message: 'post not found' });
  }

  let updateData: Record<string, unknown> = {
    tags: body.tags,
    notes: body.notes,
    contentType: body.contentType
  };

  if (regenerateSummary === 'true') {
    const rawSnapshot = (post.rawSnapshot ?? {}) as Record<string, unknown>;
    const snippet =
      (rawSnapshot.snippet as string | null | undefined) ??
      (rawSnapshot.originalSnippet as string | null | undefined) ??
      null;

    const summary = summarize({
      title: post.title,
      url: post.url,
      snippet,
      rawText: rawSnapshot ? JSON.stringify(rawSnapshot) : null,
      sourceName: post.source?.name ?? null,
      sourceTags: Array.isArray(post.source?.tags) ? (post.source?.tags as string[]) : null,
      contentType: body.contentType ?? (post.contentType as ContentType)
    });

    updateData = {
      ...updateData,
      contentType: summary.contentType,
      summaryTemplateVersion: summary.summaryTemplateVersion,
      summaryTldr: summary.summaryTldr,
      summaryPoints: summary.summaryPoints,
      signals: summary.signals,
      whyItMatters: summary.whyItMatters,
      summaryMeta: summary.summaryMeta as Prisma.InputJsonValue
    };
  }

  const updated = await prisma.post.update({
    where: { id },
    data: updateData
  });

  return { post: updated };
});

app.post('/v1/rules', async (request) => {
  const ruleSchema = z.object({
    type: RuleTypeEnum,
    pattern: z.string().min(1),
    action: RuleActionEnum,
    weight: z.number().min(0.1).max(100).default(1),
    enabled: z.boolean().default(true)
  });

  const data = ruleSchema.parse(request.body);
  const rule = await prisma.rule.create({ data });
  return { rule };
});

app.get('/v1/rules', async () => {
  const rules = await prisma.rule.findMany({ orderBy: { id: 'desc' } });
  return { rules };
});

app.get('/v1/sources', async (request) => {
  const querySchema = z.object({
    q: z.string().optional(),
    locale: FetchLocaleEnum.optional(),
    enabled: z.enum(['true', 'false']).optional(),
    category: CategoryEnum.optional()
  });

  const { q, locale, enabled, category } = querySchema.parse(request.query);

  const where: Record<string, unknown> = {};
  if (locale && locale !== 'all') {
    where.locale = locale;
  }
  if (enabled) {
    where.enabled = enabled === 'true';
  }
  if (category) {
    where.categoryDefault = category;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { key: { contains: q, mode: 'insensitive' } }
    ];
  }

  const sources = await prisma.source.findMany({
    where,
    orderBy: [{ enabled: 'desc' }, { name: 'asc' }]
  });

  return { sources };
});

app.post('/v1/sources/discover', async (request) => {
  const schema = z.object({ url: z.string().min(1) });
  const { url } = schema.parse(request.body);
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const result = await discoverFeeds(normalized);
  return {
    inputUrl: url,
    finalUrl: result.finalUrl,
    feeds: result.feeds
  };
});

app.post('/v1/sources', async (request) => {
  const schema = z.object({
    name: z.string().min(1),
    key: z
      .string()
      .min(1)
      .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
      .refine((value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      }, 'Invalid URL'),
    categoryDefault: CategoryEnum,
    locale: FetchLocaleEnum.optional(),
    enabled: z.boolean().optional(),
    weight: z.number().optional(),
    tags: z.array(z.string()).optional()
  });

  const data = schema.parse(request.body);
  const normalizedKey = canonicalizeUrl(data.key);
  const source = await prisma.source.upsert({
    where: { key: normalizedKey },
    update: {
      name: data.name,
      categoryDefault: data.categoryDefault,
      locale: data.locale === 'all' || !data.locale ? 'en' : data.locale,
      enabled: data.enabled ?? false,
      weight: data.weight ?? 1.0,
      tags: data.tags ?? []
    },
    create: {
      type: 'rss',
      name: data.name,
      key: normalizedKey,
      categoryDefault: data.categoryDefault,
      locale: data.locale === 'all' || !data.locale ? 'en' : data.locale,
      enabled: data.enabled ?? false,
      weight: data.weight ?? 1.0,
      tags: data.tags ?? []
    }
  });

  return { source };
});

app.patch('/v1/sources/:id', async (request) => {
  const paramsSchema = z.object({ id: z.string().min(1) });
  const bodySchema = z.object({
    enabled: z.boolean().optional(),
    weight: z.number().optional(),
    locale: FetchLocaleEnum.optional(),
    tags: z.array(z.string()).optional()
  });

  const { id } = paramsSchema.parse(request.params);
  const data = bodySchema.parse(request.body);

  const source = await prisma.source.update({
    where: { id },
    data: {
      enabled: data.enabled,
      weight: data.weight,
      locale: data.locale && data.locale !== 'all' ? data.locale : undefined,
      tags: data.tags
    }
  });

  return { source };
});

app.delete('/v1/sources', async (request) => {
  const schema = z.object({
    ids: z.array(z.string().min(1)).min(1)
  });
  const { ids } = schema.parse(request.body);
  await prisma.source.deleteMany({ where: { id: { in: ids } } });
  return { deleted: ids.length };
});

app.get('/v1/presets', async () => {
  const presets = await prisma.preset.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: { presetSources: true }
  });

  return {
    presets: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      isDefault: preset.isDefault,
      sourceCount: preset.presetSources.length
    }))
  };
});

app.get('/v1/presets/:id', async (request, reply) => {
  const paramsSchema = z.object({ id: z.string().min(1) });
  const { id } = paramsSchema.parse(request.params);

  const preset = await prisma.preset.findUnique({
    where: { id },
    include: {
      presetSources: {
        include: {
          source: true
        }
      }
    }
  });

  if (!preset) {
    return reply.status(404).send({ error: 'NotFound', message: 'preset not found' });
  }

  return {
    preset: {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      isDefault: preset.isDefault,
      sources: preset.presetSources.map((entry) => entry.source)
    }
  };
});

app.post('/v1/presets', async (request) => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    isDefault: z.boolean().optional()
  });

  const data = schema.parse(request.body);

  const preset = await prisma.preset.create({
    data: {
      name: data.name,
      description: data.description,
      isDefault: data.isDefault ?? false
    }
  });

  return { preset };
});

app.patch('/v1/presets/:id', async (request, reply) => {
  const paramsSchema = z.object({ id: z.string().min(1) });
  const bodySchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional()
  });

  const { id } = paramsSchema.parse(request.params);
  const body = bodySchema.parse(request.body);

  const preset = await prisma.preset.findUnique({ where: { id } });
  if (!preset) {
    return reply.status(404).send({ error: 'NotFound', message: 'preset not found' });
  }

  const updated = await prisma.preset.update({
    where: { id },
    data: {
      name: body.name ?? preset.name,
      description: body.description ?? preset.description
    }
  });

  return { preset: updated };
});

app.delete('/v1/presets', async (request) => {
  const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1) });
  const { ids } = bodySchema.parse(request.body);

  await prisma.presetSource.deleteMany({
    where: { presetId: { in: ids } }
  });

  const result = await prisma.preset.deleteMany({
    where: { id: { in: ids } }
  });

  return { deletedCount: result.count };
});

app.get('/v1/presets/:id/export', async (request, reply) => {
  const paramsSchema = z.object({ id: z.string().min(1) });
  const querySchema = z.object({ format: z.enum(['json', 'opml']).optional() });
  const { id } = paramsSchema.parse(request.params);
  const { format } = querySchema.parse(request.query);

  const preset = await prisma.preset.findUnique({
    where: { id },
    include: { presetSources: { include: { source: true } } }
  });

  if (!preset) {
    return reply.status(404).send({ error: 'NotFound', message: 'preset not found' });
  }

  const payload = ExportPresetV1Schema.parse({
    version: 'preset-v1',
    exportedAt: new Date().toISOString(),
    preset: {
      name: preset.name,
      description: preset.description ?? undefined,
      isDefault: preset.isDefault
    },
    sources: preset.presetSources.map((entry) => ({
      key: entry.source.key,
      name: entry.source.name,
      type: 'rss',
      categoryDefault: entry.source.categoryDefault,
      locale: entry.source.locale,
      enabled: entry.source.enabled,
      weight: entry.source.weight,
      tags: Array.isArray(entry.source.tags)
        ? entry.source.tags.filter((tag) => typeof tag === 'string')
        : []
    }))
  });

  if (format === 'opml') {
    const opml = buildOpml(preset.name, payload.sources);
    reply.header('Content-Type', 'text/xml; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${preset.name}.opml"`);
    return reply.send(opml);
  }

  reply.header('Content-Type', 'application/json; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${preset.name}.json"`);
  return reply.send(payload);
});

app.post('/v1/presets/import', async (request, reply) => {
  const parseOptions = (raw?: unknown) => {
    const parsed = ImportPresetOptionsSchema.safeParse(raw ?? {});
    return parsed.success ? parsed.data : {};
  };

  const normalizeOptions = (options: ReturnType<typeof parseOptions>) => ({
    mode: options.mode ?? 'upsert',
    presetNameOverride: options.presetNameOverride,
    enableImportedSources: options.enableImportedSources ?? false,
    overwriteSourceMeta: options.overwriteSourceMeta ?? false
  });

  const importSources = async (
    sources: Array<{
      key: string;
      name: string;
      type?: string;
      categoryDefault: Category;
      locale?: 'ko' | 'en';
      enabled?: boolean;
      weight?: number;
      tags?: string[];
    }>,
    options: ReturnType<typeof normalizeOptions>
  ) => {
    const normalized = sources.map((source) => ({
      ...source,
      key: canonicalizeUrl(source.key),
      locale: source.locale ?? 'en',
      enabled: options.enableImportedSources ? true : source.enabled ?? false,
      weight: source.weight ?? 1.0,
      tags: source.tags ?? []
    }));

    const uniqueByKey = new Map(normalized.map((source) => [source.key, source]));
    const uniqueSources = Array.from(uniqueByKey.values());
    const keys = uniqueSources.map((source) => source.key);
    const existing = await prisma.source.findMany({ where: { key: { in: keys } } });
    const existingKeys = new Set(existing.map((source) => source.key));

    const sourceIds: string[] = [];
    for (const source of uniqueSources) {
      const updateData = options.overwriteSourceMeta
        ? {
            name: source.name,
            categoryDefault: source.categoryDefault,
            locale: source.locale,
            enabled: source.enabled,
            weight: source.weight,
            tags: source.tags
          }
        : options.enableImportedSources
          ? { enabled: true }
          : {};

      const record = await prisma.source.upsert({
        where: { key: source.key },
        update: updateData,
        create: {
          type: 'rss',
          name: source.name,
          key: source.key,
          categoryDefault: source.categoryDefault,
          locale: source.locale ?? 'en',
          enabled: source.enabled ?? false,
          weight: source.weight ?? 1.0,
          tags: source.tags ?? []
        }
      });
      sourceIds.push(record.id);
    }

    return {
      sourceIds,
      importedSourcesCount: uniqueSources.length - existingKeys.size,
      reusedSourcesCount: existingKeys.size
    };
  };

  const inferLocale = (name: string, url: string): 'ko' | 'en' => {
    if (/\\.kr\\b/.test(url)) return 'ko';
    if (/[ㄱ-ㅎ가-힣]/.test(name)) return 'ko';
    return 'en';
  };

  const ensurePreset = async (presetName: string, description: string | undefined, options: ReturnType<typeof normalizeOptions>) => {
    if (options.mode === 'new') {
      return prisma.preset.create({
        data: {
          name: presetName,
          description
        }
      });
    }

    const existing = await prisma.preset.findFirst({ where: { name: presetName } });
    if (existing) {
      return prisma.preset.update({
        where: { id: existing.id },
        data: { description: description ?? existing.description }
      });
    }

    return prisma.preset.create({
      data: {
        name: presetName,
        description
      }
    });
  };

  let fileText: string | null = null;
  let fileName = 'imported';
  let options = normalizeOptions(parseOptions({}));

  if (request.isMultipart()) {
    const parts = request.parts();
    const fields: Record<string, string> = {};
    for await (const part of parts) {
      if (part.type === 'file') {
        fileName = part.filename ?? fileName;
        const buffer = await part.toBuffer();
        fileText = buffer.toString('utf-8');
      } else {
        fields[part.fieldname] = typeof part.value === 'string' ? part.value : String(part.value ?? '');
      }
    }
    let rawOptions: unknown = fields;
    if (fields.options) {
      try {
        rawOptions = JSON.parse(fields.options);
      } catch {
        rawOptions = fields;
      }
    }
    options = normalizeOptions(parseOptions(rawOptions));
  } else {
    const body = request.body as { preset?: unknown; options?: unknown } | undefined;
    if (body?.preset) {
      const parsed = ExportPresetV1Schema.parse(body.preset);
      const normalizedOptions = normalizeOptions(parseOptions(body.options));
      const presetName = normalizedOptions.presetNameOverride ?? parsed.preset.name;
      const preset = await ensurePreset(presetName, parsed.preset.description, normalizedOptions);
      const { sourceIds, importedSourcesCount, reusedSourcesCount } = await importSources(parsed.sources, normalizedOptions);

      await prisma.presetSource.createMany({
        data: sourceIds.map((sourceId) => ({ presetId: preset.id, sourceId })),
        skipDuplicates: true
      });

      return reply.send({
        createdOrUpdatedPresetId: preset.id,
        importedSourcesCount,
        reusedSourcesCount,
        warnings: []
      });
    }
    if ((body as any)?.version === 'preset-v1') {
      const parsed = ExportPresetV1Schema.parse(body);
      const normalizedOptions = normalizeOptions(parseOptions((body as any)?.options));
      const presetName = normalizedOptions.presetNameOverride ?? parsed.preset.name;
      const preset = await ensurePreset(presetName, parsed.preset.description, normalizedOptions);
      const { sourceIds, importedSourcesCount, reusedSourcesCount } = await importSources(parsed.sources, normalizedOptions);

      await prisma.presetSource.createMany({
        data: sourceIds.map((sourceId) => ({ presetId: preset.id, sourceId })),
        skipDuplicates: true
      });

      return reply.send({
        createdOrUpdatedPresetId: preset.id,
        importedSourcesCount,
        reusedSourcesCount,
        warnings: []
      });
    }
  }

  if (!fileText) {
    return reply.status(400).send({ error: 'BadRequest', message: 'file is required' });
  }

  const normalizedOptions = options;

  if (fileName.toLowerCase().endsWith('.json')) {
    const parsedJson = ExportPresetV1Schema.parse(JSON.parse(fileText));
    const presetName = normalizedOptions.presetNameOverride ?? parsedJson.preset.name;
    const preset = await ensurePreset(presetName, parsedJson.preset.description, normalizedOptions);
    const { sourceIds, importedSourcesCount, reusedSourcesCount } = await importSources(parsedJson.sources, normalizedOptions);

    await prisma.presetSource.createMany({
      data: sourceIds.map((sourceId) => ({ presetId: preset.id, sourceId })),
      skipDuplicates: true
    });

    return reply.send({
      createdOrUpdatedPresetId: preset.id,
      importedSourcesCount,
      reusedSourcesCount,
      warnings: []
    });
  }

  const parsedOpml = parseOpml(fileText);
  const opmlSources = parsedOpml.sources.map((source) => ({
    key: source.key,
    name: source.name,
    type: 'rss',
    categoryDefault: source.categoryDefault,
    locale: inferLocale(source.name, source.key),
    enabled: normalizedOptions.enableImportedSources ? true : false
  }));
  const presetNameFromFile = fileName.replace(/\\.[^/.]+$/, '');
  const fallbackName = `Imported OPML ${new Date().toISOString().slice(0, 10)}`;
  const presetName = normalizedOptions.presetNameOverride ?? (presetNameFromFile || fallbackName);
  const preset = await ensurePreset(presetName, 'Imported from OPML', normalizedOptions);
  const { sourceIds, importedSourcesCount, reusedSourcesCount } = await importSources(opmlSources, normalizedOptions);

  await prisma.presetSource.createMany({
    data: sourceIds.map((sourceId) => ({ presetId: preset.id, sourceId })),
    skipDuplicates: true
  });

  return reply.send({
    createdOrUpdatedPresetId: preset.id,
    importedSourcesCount,
    reusedSourcesCount,
    warnings: parsedOpml.warnings
  });
});

app.post('/v1/presets/:id/sources', async (request) => {
  const paramsSchema = z.object({ id: z.string().min(1) });
  const bodySchema = z.object({ sourceIds: z.array(z.string().min(1)).min(1) });

  const { id } = paramsSchema.parse(request.params);
  const { sourceIds } = bodySchema.parse(request.body);

  await prisma.presetSource.createMany({
    data: sourceIds.map((sourceId) => ({ presetId: id, sourceId })),
    skipDuplicates: true
  });

  return { ok: true };
});

app.delete('/v1/presets/:id/sources/:sourceId', async (request) => {
  const paramsSchema = z.object({ id: z.string().min(1), sourceId: z.string().min(1) });
  const { id, sourceId } = paramsSchema.parse(request.params);

  await prisma.presetSource.delete({
    where: {
      presetId_sourceId: {
        presetId: id,
        sourceId
      }
    }
  });

  return { ok: true };
});

const port = Number(process.env.API_PORT ?? 4002);

app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
