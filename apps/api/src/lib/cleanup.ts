import { prisma } from '@tech-radar/db';

export type CleanupResult = {
  dryRun: boolean;
  inboxCandidates: number;
  inboxDeleted: number;
  fetchRunCandidates: number;
  fetchRunDeleted: number;
  fetchRunSample?: { id: string; requestedAt: string; status?: string | null }[];
  inboxSample?: { id: string; publishedAt?: string | null; title?: string | null }[];
  config: {
    inboxDays: number;
    runKeep: number;
  };
  timestamp: string;
};

const CLEANUP_INBOX_DAYS = Number(process.env.CLEANUP_INBOX_DAYS ?? 7);
const CLEANUP_RUN_KEEP = Number(process.env.CLEANUP_RUN_KEEP ?? 100);

export async function runCleanup(dryRun: boolean): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - CLEANUP_INBOX_DAYS * 24 * 60 * 60 * 1000);

  const inboxCandidates = await prisma.fetchedItem.count({
    where: { createdAt: { lt: cutoff } }
  });
  const inboxSample = inboxCandidates > 0
    ? await prisma.fetchedItem.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true, publishedAt: true, title: true }
      })
    : [];

  let inboxDeleted = 0;
  if (!dryRun && inboxCandidates > 0) {
    const result = await prisma.fetchedItem.deleteMany({
      where: { createdAt: { lt: cutoff } }
    });
    inboxDeleted = result.count;
  }

  const totalRuns = await prisma.fetchRun.count();
  const fetchRunCandidates = Math.max(0, totalRuns - CLEANUP_RUN_KEEP);
  const fetchRunSample = fetchRunCandidates > 0
    ? await prisma.fetchRun.findMany({
        orderBy: { requestedAt: 'asc' },
        take: 5,
        select: { id: true, requestedAt: true, status: true }
      })
    : [];

  let fetchRunDeleted = 0;
  if (!dryRun && fetchRunCandidates > 0) {
    const staleRuns = await prisma.fetchRun.findMany({
      orderBy: { requestedAt: 'desc' },
      select: { id: true },
      skip: CLEANUP_RUN_KEEP
    });
    const staleIds = staleRuns.map((run) => run.id);
    if (staleIds.length > 0) {
      const result = await prisma.fetchRun.deleteMany({
        where: { id: { in: staleIds } }
      });
      fetchRunDeleted = result.count;
    }
  }

  return {
    dryRun,
    inboxCandidates,
    inboxDeleted,
    fetchRunCandidates,
    fetchRunDeleted,
    fetchRunSample: fetchRunSample.map((run) => ({
      id: run.id,
      requestedAt: run.requestedAt.toISOString(),
      status: run.status
    })),
    inboxSample: inboxSample.map((item) => ({
      id: item.id,
      publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
      title: item.title ?? null
    })),
    config: {
      inboxDays: CLEANUP_INBOX_DAYS,
      runKeep: CLEANUP_RUN_KEEP
    },
    timestamp: new Date().toISOString()
  };
}
