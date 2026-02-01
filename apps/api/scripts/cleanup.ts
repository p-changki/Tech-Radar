import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { prisma } from '@tech-radar/db';

const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
loadEnv({ path: envPath });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const CLEANUP_INBOX_DAYS = Number(process.env.CLEANUP_INBOX_DAYS ?? 7);
const CLEANUP_RUN_KEEP = Number(process.env.CLEANUP_RUN_KEEP ?? 100);

async function cleanupInbox() {
  const cutoff = new Date(Date.now() - CLEANUP_INBOX_DAYS * 24 * 60 * 60 * 1000);

  const count = await prisma.fetchedItem.count({
    where: { createdAt: { lt: cutoff } }
  });

  if (dryRun) {
    console.log(`[cleanup] inbox candidates: ${count}`);
    return;
  }

  const result = await prisma.fetchedItem.deleteMany({
    where: { createdAt: { lt: cutoff } }
  });

  console.log(`[cleanup] inbox deleted: ${result.count}`);
}

async function cleanupFetchRuns() {
  const runs = await prisma.fetchRun.findMany({
    orderBy: { requestedAt: 'desc' },
    select: { id: true }
  });

  const stale = runs.slice(CLEANUP_RUN_KEEP).map((run) => run.id);
  if (dryRun) {
    console.log(`[cleanup] fetch runs candidates: ${stale.length}`);
    return;
  }

  if (stale.length === 0) {
    console.log('[cleanup] fetch runs deleted: 0');
    return;
  }

  const result = await prisma.fetchRun.deleteMany({
    where: { id: { in: stale } }
  });

  console.log(`[cleanup] fetch runs deleted: ${result.count}`);
}

async function main() {
  console.log(`[cleanup] dry-run=${dryRun}`);
  await cleanupInbox();
  await cleanupFetchRuns();
}

main()
  .catch((error) => {
    console.error('[cleanup] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
