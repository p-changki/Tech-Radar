import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, Prisma } from '@tech-radar/db';
import { LRUCache } from 'lru-cache';
import { CategoryEnum, ContentTypeEnum, SignalsEnum, type ContentType } from '@tech-radar/shared';
import { summarize } from '@tech-radar/summarizer';

export const registerPostRoutes = (app: FastifyInstance) => {
  const listCache = new LRUCache<string, { posts: unknown[]; nextCursor?: string | null; hasMore?: boolean }>({
    max: 50,
    ttl: 10_000
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
        const hint = item.contentTypeHint ? ContentTypeEnum.safeParse(item.contentTypeHint) : null;
        const summary = summarize({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          rawText: item.raw ? JSON.stringify(item.raw) : null,
          sourceName: source?.name ?? null,
          sourceTags: Array.isArray(source?.tags) ? (source?.tags as string[]) : null,
          contentType: hint?.success ? hint.data : undefined
        });

        const rawSnapshot =
          item.raw && typeof item.raw === 'object' && !Array.isArray(item.raw)
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
        collection: null,
        status: 'inbox',
        pinned: false,
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
              originalLink:
                typeof rawSnapshot.originalLink === 'string' ? rawSnapshot.originalLink : item.url,
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
    listCache.clear();
    return { posts };
  });

  app.get('/v1/posts', async (request) => {
    const querySchema = z.object({
      limit: z.coerce.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
      category: CategoryEnum.optional(),
      contentType: ContentTypeEnum.optional(),
      signal: SignalsEnum.optional(),
      q: z.string().optional(),
      sort: z.enum(['asc', 'desc']).optional(),
      status: z.string().optional(),
      collection: z.string().optional(),
      pinnedOnly: z.string().optional(),
      lookbackDays: z.coerce.number().min(1).max(3650).optional()
    });

    const { limit, cursor, category, contentType, signal, q, sort, status, collection, pinnedOnly, lookbackDays } =
      querySchema.parse(request.query);
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (contentType) where.contentType = contentType;
    if (status) where.status = status;
    if (collection) {
      where.collection = { contains: collection, mode: 'insensitive' };
    }
    if (pinnedOnly === 'true') where.pinned = true;
    if (signal) {
      where.signals = { array_contains: [signal] };
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summaryTldr: { contains: q, mode: 'insensitive' } },
        { url: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (lookbackDays) {
      const since = new Date();
      since.setDate(since.getDate() - lookbackDays);
      where.savedAt = { gte: since };
    }

    const cacheKey = JSON.stringify({
      limit,
      cursor,
      category,
      contentType,
      signal,
      q,
      sort,
      status,
      collection,
      pinnedOnly,
      lookbackDays
    });
    const cached = listCache.get(cacheKey);
    if (cached) return cached;

    const posts = await prisma.post.findMany({
      where,
      orderBy: { savedAt: sort ?? 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1
          }
        : {})
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    const response = { posts: items, nextCursor, hasMore };
    listCache.set(cacheKey, response);
    return response;
  });

  app.delete('/v1/posts', async (request) => {
    const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1) });
    const { ids } = bodySchema.parse(request.body);

    const result = await prisma.post.deleteMany({
      where: { id: { in: ids } }
    });
    listCache.clear();
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
      notes: z.string().nullable().optional(),
      status: z.string().optional(),
      collection: z.string().nullable().optional(),
      pinned: z.boolean().optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const { regenerateSummary } = querySchema.parse(request.query);
    const body = bodySchema.parse(request.body);

    const post = await prisma.post.findUnique({ where: { id }, include: { source: true } });
    if (!post) {
      return reply.status(404).send({ error: 'NotFound', message: 'post not found' });
    }

    let updateData: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(body, 'tags')) updateData.tags = body.tags;
    if (Object.prototype.hasOwnProperty.call(body, 'notes')) updateData.notes = body.notes;
    if (body.contentType) updateData.contentType = body.contentType;
    if (body.status) updateData.status = body.status;
    if (Object.prototype.hasOwnProperty.call(body, 'collection')) updateData.collection = body.collection;
    if (Object.prototype.hasOwnProperty.call(body, 'pinned')) updateData.pinned = body.pinned;

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

    listCache.clear();
    return { post: updated };
  });
};
