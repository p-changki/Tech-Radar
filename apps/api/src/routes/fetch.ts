import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tech-radar/db';
import { FetchRunParamsSchema, normalizeFetchRunParams } from '@tech-radar/shared';

export const registerFetchRoutes = (app: FastifyInstance) => {
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

  app.get('/v1/fetch/summary', async (request) => {
    const querySchema = z.object({
      days: z.coerce.number().min(1).max(90).default(7)
    });
    const { days } = querySchema.parse(request.query);

    const today = new Date();
    const dayBuckets: Array<{ key: string; label: string; count: number }> = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString().slice(0, 10);
      const label = `${day.getMonth() + 1}.${day.getDate()}`;
      dayBuckets.push({ key, label, count: 0 });
    }

    const since = new Date();
    since.setDate(today.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const runs = await prisma.fetchRun.findMany({
      where: { requestedAt: { gte: since } },
      select: {
        requestedAt: true,
        _count: { select: { fetchedItems: true } }
      }
    });

    const bucketMap = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]));
    let totalItems = 0;
    runs.forEach((run) => {
      const dayKey = new Date(run.requestedAt).toISOString().slice(0, 10);
      const bucket = bucketMap.get(dayKey);
      if (!bucket) return;
      bucket.count += run._count.fetchedItems;
      totalItems += run._count.fetchedItems;
    });

    return {
      days: dayBuckets.map(({ key, label, count }) => ({ date: key, label, count })),
      totalRuns: runs.length,
      totalItems
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

    const toResponseItem = (item: (typeof items)[number]) => ({
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
      return { items: items.map(toResponseItem) };
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
};
