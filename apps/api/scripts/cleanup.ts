import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { prisma } from '@tech-radar/db';
import { runCleanup } from '../src/lib/cleanup.js';

const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
loadEnv({ path: envPath });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function main() {
  console.log(`[cleanup] dry-run=${dryRun}`);
  const result = await runCleanup(dryRun);
  console.log(`[cleanup] inbox candidates: ${result.inboxCandidates}`);
  if (!dryRun) {
    console.log(`[cleanup] inbox deleted: ${result.inboxDeleted}`);
  }
  console.log(`[cleanup] fetch runs candidates: ${result.fetchRunCandidates}`);
  if (!dryRun) {
    console.log(`[cleanup] fetch runs deleted: ${result.fetchRunDeleted}`);
  }
}

main()
  .catch((error) => {
    console.error('[cleanup] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
