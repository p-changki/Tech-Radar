import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { runCleanup } from '../lib/cleanup.js';
import { prisma } from '@tech-radar/db';

export const registerMaintenanceRoutes = (app: FastifyInstance) => {
  const findRepoRoot = () => {
    let current = process.cwd();
    for (let i = 0; i < 6; i += 1) {
      const workspace = path.join(current, 'pnpm-workspace.yaml');
      const turbo = path.join(current, 'turbo.json');
      if (existsSync(workspace) || existsSync(turbo)) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return process.cwd();
  };

  app.get('/v1/maintenance/cleanup', async (request) => {
    const querySchema = z.object({
      dryRun: z.enum(['true', 'false']).optional()
    });
    const { dryRun } = querySchema.parse(request.query);
    const result = await runCleanup(dryRun !== 'false');
    return { ok: true, result };
  });

  app.post('/v1/maintenance/cleanup', async (request) => {
    const bodySchema = z.object({
      dryRun: z.boolean().optional()
    });
    const { dryRun } = bodySchema.parse(request.body ?? {});
    const result = await runCleanup(dryRun ?? false);
    return { ok: true, result };
  });

  app.post('/v1/maintenance/turbo-clean', async () => {
    const root = findRepoRoot();
    const turboDir = path.join(root, '.turbo');
    const existed = existsSync(turboDir);
    if (existed) {
      await rm(turboDir, { recursive: true, force: true });
    }
    return { ok: true, removed: existed };
  });

  const getResetPreview = async (mode: 'soft' | 'full', includePosts: boolean) => {
    const [fetchJobs, fetchRuns, fetchedItems, posts, rules, domainStats, sources, presets, presetSources] =
      await Promise.all([
        prisma.fetchJob.count(),
        prisma.fetchRun.count(),
        prisma.fetchedItem.count(),
        prisma.post.count(),
        prisma.rule.count(),
        prisma.domainStat.count(),
        prisma.source.count(),
        prisma.preset.count(),
        prisma.presetSource.count()
      ]);

    return {
      mode,
      includePosts,
      counts: {
        fetchJobs,
        fetchRuns,
        fetchedItems,
        posts: includePosts ? posts : 0,
        rules,
        domainStats,
        sources: mode === 'full' ? sources : 0,
        presets: mode === 'full' ? presets : 0,
        presetSources: mode === 'full' ? presetSources : 0
      }
    };
  };

  app.get('/v1/maintenance/db-reset/preview', async (request) => {
    const querySchema = z.object({
      mode: z.enum(['soft', 'full']).optional(),
      includePosts: z.enum(['true', 'false']).optional()
    });
    const { mode, includePosts } = querySchema.parse(request.query);
    const preview = await getResetPreview(mode ?? 'soft', includePosts !== 'false');
    return { ok: true, preview };
  });

  app.post('/v1/maintenance/db-reset', async (request) => {
    const bodySchema = z.object({
      mode: z.enum(['soft', 'full']).optional(),
      includePosts: z.boolean().optional()
    });
    const { mode, includePosts } = bodySchema.parse(request.body ?? {});
    const resetMode = mode ?? 'soft';
    const deletePosts = includePosts !== false;

    // 데이터 초기화 (스키마/마이그레이션 건드리지 않음)
    const fetchJobs = await prisma.fetchJob.deleteMany();
    const fetchedItems = await prisma.fetchedItem.deleteMany();
    const fetchRuns = await prisma.fetchRun.deleteMany();
    const posts = deletePosts ? await prisma.post.deleteMany() : { count: 0 };
    const rules = await prisma.rule.deleteMany();
    const domainStats = await prisma.domainStat.deleteMany();

    let presetSources = { count: 0 };
    let presets = { count: 0 };
    let sources = { count: 0 };
    if (resetMode === 'full') {
      presetSources = await prisma.presetSource.deleteMany();
      presets = await prisma.preset.deleteMany();
      sources = await prisma.source.deleteMany();
    }

    return {
      ok: true,
      result: {
        mode: resetMode,
        includePosts: deletePosts,
        fetchJobs: fetchJobs.count,
        fetchRuns: fetchRuns.count,
        fetchedItems: fetchedItems.count,
        posts: posts.count,
        rules: rules.count,
        domainStats: domainStats.count,
        presetSources: presetSources.count,
        presets: presets.count,
        sources: sources.count
      }
    };
  });
};
