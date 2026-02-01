import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tech-radar/db';
import { LRUCache } from 'lru-cache';
import { CategoryEnum, FetchLocaleEnum, canonicalizeUrl } from '@tech-radar/shared';
import { discoverFeeds } from '../lib/feedDiscovery.js';

export const registerSourceRoutes = (app: FastifyInstance) => {
  const listCache = new LRUCache<string, { sources: unknown[] }>({
    max: 50,
    ttl: 10_000
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

    const cacheKey = JSON.stringify({ q, locale, enabled, category });
    const cached = listCache.get(cacheKey);
    if (cached) return cached;

    const sources = await prisma.source.findMany({
      where,
      orderBy: [{ enabled: 'desc' }, { name: 'asc' }]
    });
    const response = { sources };
    listCache.set(cacheKey, response);
    return response;
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

    listCache.clear();
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

    listCache.clear();
    return { source };
  });

  app.delete('/v1/sources', async (request) => {
    const schema = z.object({
      ids: z.array(z.string().min(1)).min(1)
    });
    const { ids } = schema.parse(request.body);
    await prisma.source.deleteMany({ where: { id: { in: ids } } });
    listCache.clear();
    return { deleted: ids.length };
  });
};
