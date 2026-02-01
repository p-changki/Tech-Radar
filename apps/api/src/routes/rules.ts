import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tech-radar/db';
import { RuleActionEnum, RuleTypeEnum } from '@tech-radar/shared';

export const registerRuleRoutes = (app: FastifyInstance) => {
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

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

  app.patch('/v1/rules/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const bodySchema = z.object({
      type: RuleTypeEnum.optional(),
      pattern: z.string().min(1).optional(),
      action: RuleActionEnum.optional(),
      weight: z.number().min(0.1).max(100).optional(),
      enabled: z.boolean().optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const data = bodySchema.parse(request.body);

    const updated = await prisma.rule.update({
      where: { id },
      data
    });

    return { rule: updated };
  });

  app.delete('/v1/rules/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const { id } = paramsSchema.parse(request.params);

    await prisma.rule.delete({ where: { id } });
    return { ok: true };
  });

  app.post('/v1/rules/preview', async (request) => {
    const previewSchema = z.object({
      type: RuleTypeEnum,
      pattern: z.string().min(1),
      action: RuleActionEnum,
      weight: z.number().min(0.1).max(100).default(1),
      days: z.coerce.number().min(1).max(365).default(7)
    });

    const { type, pattern, action, days } = previewSchema.parse(request.body);
    const tokens = pattern
      .split('|')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length === 0) {
      return { count: 0, samples: [] };
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const recentPosts = await prisma.post.findMany({
      where: { savedAt: { gte: since } },
      orderBy: { savedAt: 'desc' },
      take: 300,
      select: {
        id: true,
        title: true,
        url: true,
        summaryTldr: true,
        savedAt: true,
        publishedAt: true,
        rawSnapshot: true
      }
    });

    const matches = recentPosts.filter((post) => {
      if (type === 'domain') {
        const domain = getDomain(post.url).toLowerCase();
        return tokens.some((token) => domain.includes(token));
      }
      if (type === 'source') {
        const raw = (post.rawSnapshot ?? {}) as Record<string, unknown>;
        const sourceName = typeof raw.sourceName === 'string' ? raw.sourceName.toLowerCase() : '';
        return tokens.some((token) => sourceName.includes(token));
      }
      const text = `${post.title} ${post.summaryTldr ?? ''} ${post.url}`.toLowerCase();
      return tokens.some((token) => text.includes(token));
    });

    const samples = matches.slice(0, 5).map((post) => ({
      id: post.id,
      title: post.title,
      url: post.url,
      sourceDomain: getDomain(post.url),
      savedAt: post.savedAt,
      publishedAt: post.publishedAt
    }));

    return {
      count: matches.length,
      impact: action === 'mute' ? `mute 예상 ${matches.length}개` : `boost 예상 ${matches.length}개`,
      impactRate: recentPosts.length > 0 ? Math.round((matches.length / recentPosts.length) * 100) : 0,
      total: recentPosts.length,
      samples
    };
  });
};
