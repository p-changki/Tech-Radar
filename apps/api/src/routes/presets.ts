import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tech-radar/db';
import { LRUCache } from 'lru-cache';
import {
  ExportPresetV1Schema,
  ImportPresetOptionsSchema,
  buildOpml,
  parseOpml,
  canonicalizeUrl,
  type Category
} from '@tech-radar/shared';

export const registerPresetRoutes = (app: FastifyInstance) => {
  const listCache = new LRUCache<string, { presets: unknown[] }>({
    max: 30,
    ttl: 10_000
  });

  app.get('/v1/presets', async () => {
    const cached = listCache.get('all');
    if (cached) return cached;

    const presets = await prisma.preset.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { presetSources: true }
    });

    const response = {
      presets: presets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        description: preset.description,
        isDefault: preset.isDefault,
        sourceCount: preset.presetSources.length
      }))
    };
    listCache.set('all', response);
    return response;
  });

  app.get('/v1/presets/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const { id } = paramsSchema.parse(request.params);

    const preset = await prisma.preset.findUnique({
      where: { id },
      include: {
        presetSources: {
          include: {
            source: true
          }
        }
      }
    });

    if (!preset) {
      return reply.status(404).send({ error: 'NotFound', message: 'preset not found' });
    }

    return {
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        isDefault: preset.isDefault,
        sources: preset.presetSources.map((entry) => entry.source)
      }
    };
  });

  app.post('/v1/presets', async (request) => {
    const bodySchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      isDefault: z.boolean().optional()
    });

    const data = bodySchema.parse(request.body);
    if (data.isDefault) {
      await prisma.preset.updateMany({
        data: { isDefault: false },
        where: { isDefault: true }
      });
    }

    const preset = await prisma.preset.create({
      data: {
        name: data.name,
        description: data.description,
        isDefault: data.isDefault ?? false
      }
    });

    listCache.clear();
    return { preset };
  });

  app.patch('/v1/presets/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      isDefault: z.boolean().optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const data = bodySchema.parse(request.body);

    if (data.isDefault) {
      await prisma.preset.updateMany({
        data: { isDefault: false },
        where: { isDefault: true }
      });
    }

    const preset = await prisma.preset.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isDefault: data.isDefault
      }
    });

    listCache.clear();
    return { preset };
  });

  app.delete('/v1/presets', async (request) => {
    const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1) });
    const { ids } = bodySchema.parse(request.body);

    const result = await prisma.preset.deleteMany({
      where: { id: { in: ids } }
    });

    listCache.clear();
    return { deletedCount: result.count };
  });

  app.get('/v1/presets/:id/export', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const querySchema = z.object({ format: z.enum(['json', 'opml']).optional() });
    const { id } = paramsSchema.parse(request.params);
    const { format } = querySchema.parse(request.query);

    const preset = await prisma.preset.findUnique({
      where: { id },
      include: {
        presetSources: {
          include: {
            source: true
          }
        }
      }
    });

    if (!preset) {
      return reply.status(404).send({ error: 'NotFound', message: 'preset not found' });
    }

    const payload = ExportPresetV1Schema.parse({
      version: 'preset-v1',
      exportedAt: new Date().toISOString(),
      preset: {
        name: preset.name,
        description: preset.description ?? undefined,
        isDefault: preset.isDefault
      },
      sources: preset.presetSources.map((entry) => ({
        key: entry.source.key,
        name: entry.source.name,
        type: entry.source.type,
        categoryDefault: entry.source.categoryDefault,
        locale: entry.source.locale,
        enabled: entry.source.enabled,
        weight: entry.source.weight ?? 1,
        tags: Array.isArray(entry.source.tags) ? (entry.source.tags as string[]) : []
      }))
    });

    if (format === 'opml') {
      const opml = buildOpml(preset.name, payload.sources);
      reply.header('Content-Type', 'text/xml; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="${preset.name}.opml"`);
      return reply.send(opml);
    }

    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${preset.name}.json"`);
    return reply.send(payload);
  });

  app.post('/v1/presets/import', async (request, reply) => {
    const parseOptions = (raw?: unknown) => {
      const parsed = ImportPresetOptionsSchema.safeParse(raw ?? {});
      return parsed.success ? parsed.data : {};
    };

    const normalizeOptions = (options: ReturnType<typeof parseOptions>) => ({
      mode: options.mode ?? 'upsert',
      presetNameOverride: options.presetNameOverride,
      enableImportedSources: options.enableImportedSources ?? false,
      overwriteSourceMeta: options.overwriteSourceMeta ?? false
    });

    const importSources = async (
      sources: Array<{
        key: string;
        name: string;
        type?: string;
        categoryDefault: Category;
        locale?: 'ko' | 'en';
        enabled?: boolean;
        weight?: number;
        tags?: string[];
      }>,
      options: ReturnType<typeof normalizeOptions>
    ) => {
      const normalized = sources.map((source) => ({
        ...source,
        key: canonicalizeUrl(source.key),
        locale: source.locale ?? 'en',
        enabled: options.enableImportedSources ? true : source.enabled ?? false,
        weight: source.weight ?? 1.0,
        tags: source.tags ?? []
      }));

      const uniqueByKey = new Map(normalized.map((source) => [source.key, source]));
      const uniqueSources = Array.from(uniqueByKey.values());
      const keys = uniqueSources.map((source) => source.key);
      const existing = await prisma.source.findMany({ where: { key: { in: keys } } });
      const existingKeys = new Set(existing.map((source) => source.key));

      const sourceIds: string[] = [];
      for (const source of uniqueSources) {
        const updateData = options.overwriteSourceMeta
          ? {
              name: source.name,
              categoryDefault: source.categoryDefault,
              locale: source.locale,
              enabled: source.enabled,
              weight: source.weight,
              tags: source.tags
            }
          : options.enableImportedSources
            ? { enabled: true }
            : {};

        const record = await prisma.source.upsert({
          where: { key: source.key },
          update: updateData,
          create: {
            type: 'rss',
            name: source.name,
            key: source.key,
            categoryDefault: source.categoryDefault,
            locale: source.locale ?? 'en',
            enabled: source.enabled ?? false,
            weight: source.weight ?? 1.0,
            tags: source.tags ?? []
          }
        });
        sourceIds.push(record.id);
      }

      return {
        sourceIds,
        importedSourcesCount: uniqueSources.length - existingKeys.size,
        reusedSourcesCount: existingKeys.size
      };
    };

    const inferLocale = (name: string, url: string): 'ko' | 'en' => {
      if (/\.kr\b/.test(url)) return 'ko';
      if (/[ㄱ-ㅎ가-힣]/.test(name)) return 'ko';
      return 'en';
    };

    const ensurePreset = async (
      presetName: string,
      description: string | undefined,
      options: ReturnType<typeof normalizeOptions>
    ) => {
      if (options.mode === 'new') {
        return prisma.preset.create({
          data: {
            name: presetName,
            description
          }
        });
      }

      const existing = await prisma.preset.findFirst({ where: { name: presetName } });
      if (existing) {
        return prisma.preset.update({
          where: { id: existing.id },
          data: { description: description ?? existing.description }
        });
      }

      return prisma.preset.create({
        data: {
          name: presetName,
          description
        }
      });
    };

    let fileText: string | null = null;
    let fileName = 'imported';
    let options = normalizeOptions(parseOptions({}));

    if (request.isMultipart()) {
      const parts = request.parts();
      const fields: Record<string, string> = {};
      for await (const part of parts) {
        if (part.type === 'file') {
          fileName = part.filename ?? fileName;
          const buffer = await part.toBuffer();
          fileText = buffer.toString('utf-8');
        } else {
          fields[part.fieldname] = typeof part.value === 'string' ? part.value : String(part.value ?? '');
        }
      }
      let rawOptions: unknown = fields;
      if (fields.options) {
        try {
          rawOptions = JSON.parse(fields.options);
        } catch {
          rawOptions = fields;
        }
      }
      options = normalizeOptions(parseOptions(rawOptions));
    } else {
      const body = request.body as { preset?: unknown; options?: unknown } | undefined;
      if (body?.preset) {
        const parsed = ExportPresetV1Schema.parse(body.preset);
        const normalizedOptions = normalizeOptions(parseOptions(body.options));
        const presetName = normalizedOptions.presetNameOverride ?? parsed.preset.name;
        const preset = await ensurePreset(presetName, parsed.preset.description, normalizedOptions);
        const { sourceIds, importedSourcesCount, reusedSourcesCount } = await importSources(
          parsed.sources,
          normalizedOptions
        );

        await prisma.presetSource.createMany({
          data: sourceIds.map((sourceId) => ({ presetId: preset.id, sourceId })),
          skipDuplicates: true
        });

        listCache.clear();
        return reply.send({
          createdOrUpdatedPresetId: preset.id,
          importedSourcesCount,
          reusedSourcesCount,
          warnings: []
        });
      }
      if ((body as any)?.version === 'preset-v1') {
        const parsed = ExportPresetV1Schema.parse(body);
        const normalizedOptions = normalizeOptions(parseOptions((body as any)?.options));
        const presetName = normalizedOptions.presetNameOverride ?? parsed.preset.name;
        const preset = await ensurePreset(presetName, parsed.preset.description, normalizedOptions);
        const { sourceIds, importedSourcesCount, reusedSourcesCount } = await importSources(
          parsed.sources,
          normalizedOptions
        );

        await prisma.presetSource.createMany({
          data: sourceIds.map((sourceId) => ({ presetId: preset.id, sourceId })),
          skipDuplicates: true
        });

        listCache.clear();
        return reply.send({
          createdOrUpdatedPresetId: preset.id,
          importedSourcesCount,
          reusedSourcesCount,
          warnings: []
        });
      }
    }

    if (!fileText) {
      return reply.status(400).send({ error: 'BadRequest', message: 'file is required' });
    }

    const normalizedOptions = options;

    if (fileName.toLowerCase().endsWith('.json')) {
      const parsedJson = ExportPresetV1Schema.parse(JSON.parse(fileText));
      const presetName = normalizedOptions.presetNameOverride ?? parsedJson.preset.name;
      const preset = await ensurePreset(presetName, parsedJson.preset.description, normalizedOptions);
      const { sourceIds, importedSourcesCount, reusedSourcesCount } = await importSources(
        parsedJson.sources,
        normalizedOptions
      );

      await prisma.presetSource.createMany({
        data: sourceIds.map((sourceId) => ({ presetId: preset.id, sourceId })),
        skipDuplicates: true
      });

      listCache.clear();
      return reply.send({
        createdOrUpdatedPresetId: preset.id,
        importedSourcesCount,
        reusedSourcesCount,
        warnings: []
      });
    }

    const parsedOpml = parseOpml(fileText);
    const opmlSources = parsedOpml.sources.map((source) => ({
      key: source.key,
      name: source.name,
      type: 'rss',
      categoryDefault: source.categoryDefault,
      locale: inferLocale(source.name, source.key),
      enabled: normalizedOptions.enableImportedSources ? true : false
    }));
    const presetNameFromFile = fileName.replace(/\.[^/.]+$/, '');
    const fallbackName = `Imported OPML ${new Date().toISOString().slice(0, 10)}`;
    const presetName = normalizedOptions.presetNameOverride ?? (presetNameFromFile || fallbackName);
    const preset = await ensurePreset(presetName, 'Imported from OPML', normalizedOptions);
    const { sourceIds, importedSourcesCount, reusedSourcesCount } = await importSources(
      opmlSources,
      normalizedOptions
    );

    await prisma.presetSource.createMany({
      data: sourceIds.map((sourceId) => ({ presetId: preset.id, sourceId })),
      skipDuplicates: true
    });

    listCache.clear();
    return reply.send({
      createdOrUpdatedPresetId: preset.id,
      importedSourcesCount,
      reusedSourcesCount,
      warnings: parsedOpml.warnings
    });
  });

  app.post('/v1/presets/:id/sources', async (request) => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const bodySchema = z.object({ sourceIds: z.array(z.string().min(1)).min(1) });

    const { id } = paramsSchema.parse(request.params);
    const { sourceIds } = bodySchema.parse(request.body);

    await prisma.presetSource.createMany({
      data: sourceIds.map((sourceId) => ({ presetId: id, sourceId })),
      skipDuplicates: true
    });

    listCache.clear();
    return { ok: true };
  });

  app.delete('/v1/presets/:id/sources/:sourceId', async (request) => {
    const paramsSchema = z.object({ id: z.string().min(1), sourceId: z.string().min(1) });
    const { id, sourceId } = paramsSchema.parse(request.params);

    await prisma.presetSource.delete({
      where: {
        presetId_sourceId: {
          presetId: id,
          sourceId
        }
      }
    });

    listCache.clear();
    return { ok: true };
  });
};
