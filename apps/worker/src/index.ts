import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { prisma } from '@tech-radar/db';
import { processFetchRun } from './processor.js';

const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
loadEnv({ path: envPath });

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1000);

async function claimJob() {
  const jobs = await prisma.$queryRaw<
    Array<{
      id: string;
      runId: string;
      status: string;
      attempts: number;
      maxAttempts: number;
    }>
  >`
    UPDATE "FetchJob"
    SET status = 'running',
        "lockedAt" = NOW(),
        attempts = attempts + 1,
        "updatedAt" = NOW()
    WHERE id = (
      SELECT id FROM "FetchJob"
      WHERE status = 'queued' AND attempts < "maxAttempts"
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "runId", status, attempts, "maxAttempts";
  `;

  return jobs[0] ?? null;
}

async function runOnce() {
  const job = await claimJob();
  if (!job) return false;

  try {
    await processFetchRun(job.runId);
    await prisma.fetchJob.update({
      where: { id: job.id },
      data: { status: 'success', error: null }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch run failed';
    const shouldFail = job.attempts >= job.maxAttempts;
    await prisma.fetchJob.update({
      where: { id: job.id },
      data: {
        status: shouldFail ? 'failed' : 'queued',
        error: message
      }
    });

    if (shouldFail) {
      await prisma.fetchRun.update({
        where: { id: job.runId },
        data: { status: 'failed', error: message }
      });
    }
  }

  return true;
}

async function loop() {
  let idle = false;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const handled = await runOnce();
    if (!handled) {
      if (!idle) {
        idle = true;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } else {
      idle = false;
    }
  }
}

loop().catch((error) => {
  console.error('worker failed', error);
  process.exit(1);
});
