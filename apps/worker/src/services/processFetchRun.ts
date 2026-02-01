import { prisma } from '@tech-radar/db';
import {
  canonicalizeUrl,
  computeDomainConcurrency,
  getHostname,
  normalizeFetchRunParams,
  updateDomainStat,
  type FetchRunParams,
  type FetchedItemDTO
} from '@tech-radar/shared';
import { fetchItemsDummy, fetchItemsReal } from '@tech-radar/connectors';

const MAX_SOURCES_PER_RUN = 50;

async function resolveSources(params: ReturnType<typeof normalizeFetchRunParams>) {
  let sources = [] as Awaited<ReturnType<typeof prisma.source.findMany>>;

  if (params.presetId) {
    const preset = await prisma.preset.findUnique({
      where: { id: params.presetId },
      include: { presetSources: { include: { source: true } } }
    });
    sources = preset?.presetSources.map((entry) => entry.source) ?? [];
  } else if (params.sourceIds && params.sourceIds.length > 0) {
    sources = await prisma.source.findMany({
      where: { id: { in: params.sourceIds } }
    });
  } else {
    const defaultPreset = await prisma.preset.findFirst({
      where: { isDefault: true },
      include: { presetSources: { include: { source: true } } }
    });
    if (defaultPreset) {
      sources = defaultPreset.presetSources.map((entry) => entry.source);
    } else {
      sources = await prisma.source.findMany({ where: { enabled: true } });
    }
  }

  if (params.locale !== 'all') {
    sources = sources.filter((source) => source.locale === params.locale);
  }

  const toDisable = sources.filter((source) => source.enabled && source.consecutiveFailures >= 5);
  if (toDisable.length > 0) {
    await prisma.source.updateMany({
      where: { id: { in: toDisable.map((source) => source.id) } },
      data: { enabled: false }
    });
  }

  sources = sources.filter((source) => source.enabled && source.consecutiveFailures < 5);
  sources.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));

  return sources.slice(0, MAX_SOURCES_PER_RUN);
}

function dedupeForStorage(items: FetchedItemDTO[]): FetchedItemDTO[] {
  const map = new Map<string, FetchedItemDTO>();

  for (const item of items) {
    const canonical = canonicalizeUrl(item.url);
    const existing = map.get(canonical);
    if (!existing || (item.score ?? 0) > (existing.score ?? 0)) {
      map.set(canonical, {
        ...item,
        url: canonical,
        raw: {
          ...(item.raw ?? {}),
          originalLink: (item.raw as { originalLink?: string } | undefined)?.originalLink ?? item.url,
          canonicalUrl: canonical
        }
      });
    }
  }

  return Array.from(map.values());
}

async function buildDomainConcurrencyMap(
  sources: Awaited<ReturnType<typeof prisma.source.findMany>>
): Promise<Record<string, number>> {
  const hostnames = Array.from(
    new Set(sources.map((source) => getHostname(source.key) ?? 'unknown'))
  );
  const stats = await prisma.domainStat.findMany({
    where: { hostname: { in: hostnames } }
  });
  const statMap = new Map(stats.map((stat) => [stat.hostname, stat]));

  const concurrencyMap: Record<string, number> = {};
  for (const hostname of hostnames) {
    const stat = statMap.get(hostname) ?? null;
    const concurrency = computeDomainConcurrency(stat, { base: 2, degraded: 1 });
    concurrencyMap[hostname] = concurrency;
  }

  return concurrencyMap;
}

export async function processFetchRun(runId: string) {
  const run = await prisma.fetchRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw new Error('FetchRun not found');
  }

  const params = normalizeFetchRunParams(run.params as FetchRunParams);
  const sources = await resolveSources(params);
  const rules = await prisma.rule.findMany({ where: { enabled: true } });
  const domainConcurrency = await buildDomainConcurrencyMap(sources);

  const startTime = Date.now();

  const { itemsByCategory, sourceReports } =
    params.mode === 'dummy'
      ? fetchItemsDummy({ params: run.params as FetchRunParams, sources, rules })
      : await fetchItemsReal({ params: run.params as FetchRunParams, sources, rules, domainConcurrency });

  if (sourceReports.length > 0) {
    const successReports = sourceReports.filter((report) => report.status === 200);
    const notModifiedReports = sourceReports.filter((report) => report.status === 304);
    const failedReports = sourceReports.filter(
      (report) => report.status >= 400 || report.status === 0
    );

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const hostnames = Array.from(new Set(sourceReports.map((report) => report.hostname)));
      const existingStats = await tx.domainStat.findMany({
        where: { hostname: { in: hostnames } }
      });
      const statMap = new Map(existingStats.map((stat) => [stat.hostname, stat]));

      for (const report of sourceReports) {
        const sample = {
          ok: report.status === 200 || report.status === 304,
          latencyMs: report.latencyMs,
          status: report.status
        };

        const existingStat = statMap.get(report.hostname) ?? null;
        const patch = updateDomainStat(existingStat, sample);

        await tx.domainStat.upsert({
          where: { hostname: report.hostname },
          update: {
            lastUpdatedAt: patch.lastUpdatedAt,
            windowSize: patch.windowSize,
            samples: patch.samples,
            avgLatencyMs: patch.avgLatencyMs,
            failRate: patch.failRate,
            consecutiveFailures: patch.consecutiveFailures
          },
          create: {
            hostname: report.hostname,
            lastUpdatedAt: patch.lastUpdatedAt,
            windowSize: patch.windowSize,
            samples: patch.samples,
            avgLatencyMs: patch.avgLatencyMs,
            failRate: patch.failRate,
            consecutiveFailures: patch.consecutiveFailures
          }
        });
      }

      if (successReports.length > 0) {
        await tx.source.updateMany({
          where: { id: { in: successReports.map((report) => report.sourceId) } },
          data: {
            lastFetchedAt: now,
            lastStatus: 200,
            lastError: null,
            consecutiveFailures: 0
          }
        });

        for (const report of successReports) {
          if (report.etag || report.lastModified) {
            await tx.source.update({
              where: { id: report.sourceId },
              data: {
                etag: report.etag ?? undefined,
                lastModified: report.lastModified ?? undefined
              }
            });
          }
        }
      }

      if (notModifiedReports.length > 0) {
        await tx.source.updateMany({
          where: { id: { in: notModifiedReports.map((report) => report.sourceId) } },
          data: {
            lastFetchedAt: now,
            lastStatus: 304,
            lastError: null,
            consecutiveFailures: 0
          }
        });
      }

      for (const report of failedReports) {
        const updated = await tx.source.update({
          where: { id: report.sourceId },
          data: {
            lastFetchedAt: now,
            lastStatus: report.status || null,
            lastError: report.error ?? 'fetch failed',
            consecutiveFailures: { increment: 1 }
          },
          select: { consecutiveFailures: true }
        });

        if (updated.consecutiveFailures >= 5) {
          await tx.source.update({
            where: { id: report.sourceId },
            data: { enabled: false }
          });
        }
      }
    });
  }

  const flatItems = Object.values(itemsByCategory).flat();
  const dedupedItems = dedupeForStorage(flatItems);

  let createdCount = 0;
  const seenItemIds = new Set<string>();
  if (dedupedItems.length > 0) {
    const existingUrls = await prisma.fetchedItem.findMany({
      where: { url: { in: dedupedItems.map((item) => item.url) } },
      select: { id: true, url: true }
    });
    const existingUrlSet = new Set(existingUrls.map((entry) => entry.url));
    existingUrls.forEach((entry) => seenItemIds.add(entry.id));

    const newItems = dedupedItems.filter((item) => !existingUrlSet.has(item.url));
    if (newItems.length > 0) {
      const result = await prisma.fetchedItem.createMany({
        data: newItems.map((item) => ({
          runId: run.id,
          category: item.category,
          sourceId: item.sourceId ?? null,
          contentTypeHint: item.contentTypeHint ?? null,
          title: item.title,
          url: item.url,
          publishedAt: item.publishedAt,
          snippet: item.snippet ?? null,
          signals: item.signals ?? [],
          score: item.score ?? 0,
          raw: item.raw ?? undefined
        })),
        skipDuplicates: true
      });
      createdCount = result.count;
    }
  }

  const sourceSuccess = sourceReports.filter((result) => result.status === 200).length;
  const sourceNotModified = sourceReports.filter((result) => result.status === 304).length;
  const sourceFailures = sourceReports.filter(
    (result) => result.status >= 400 || result.status === 0
  ).length;

  const anySuccess = sourceReports.some(
    (result) => result.status === 200 || result.status === 304
  );
  const success = anySuccess || createdCount > 0;

  await prisma.fetchRun.update({
    where: { id: run.id },
    data: {
      status: success ? 'success' : 'failed',
      durationMs: Date.now() - startTime,
      error: success ? null : 'all sources failed',
      result: {
        sources: sourceReports.map((report) => ({
          sourceId: report.sourceId,
          name: report.name,
          hostname: report.hostname,
          status: report.status,
          fetchedCount: report.fetchedCount,
          latencyMs: report.latencyMs,
          domainConcurrencyApplied: report.domainConcurrencyApplied,
          error: report.error
        })),
        seenItemIds: Array.from(seenItemIds),
        counts: {
          totalFetched: flatItems.length,
          totalStored: createdCount,
          sourceSuccess,
          sourceNotModified,
          sourceFailures
        }
      }
    }
  });
}
