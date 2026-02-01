import { z } from 'zod';
import { XMLParser } from 'fast-xml-parser';

export const ExportPresetSourceSchema = z.object({
  key: z.string().url(),
  name: z.string().min(1),
  type: z.literal('rss'),
  categoryDefault: z.enum(['AI', 'FE', 'BE', 'DEVOPS', 'DATA', 'SECURITY', 'OTHER']),
  locale: z.enum(['ko', 'en']).optional(),
  enabled: z.boolean().optional(),
  weight: z.number().optional(),
  tags: z.array(z.string()).optional()
});

export const ExportPresetV1Schema = z.object({
  version: z.literal('preset-v1'),
  exportedAt: z.string().datetime({ offset: true }),
  preset: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    isDefault: z.boolean().optional()
  }),
  sources: z.array(ExportPresetSourceSchema)
});

export type ExportPresetV1 = z.infer<typeof ExportPresetV1Schema>;

export const ImportPresetOptionsSchema = z.object({
  mode: z.enum(['upsert', 'new']).optional(),
  presetNameOverride: z.string().min(1).optional(),
  enableImportedSources: z.boolean().optional(),
  overwriteSourceMeta: z.boolean().optional()
});

export type ImportPresetOptions = z.infer<typeof ImportPresetOptionsSchema>;

const CATEGORY_SET = new Set([
  'AI',
  'FE',
  'BE',
  'DEVOPS',
  'DATA',
  'SECURITY',
  'OTHER',
  'MISC',
  'ETC',
  '기타'
]);

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildOpml(presetName: string, sources: ExportPresetV1['sources']): string {
  const grouped = sources.reduce<Record<string, ExportPresetV1['sources']>>((acc, source) => {
    const bucket = acc[source.categoryDefault] ?? [];
    bucket.push(source);
    acc[source.categoryDefault] = bucket;
    return acc;
  }, {});

  const body = Object.keys(grouped)
    .sort()
    .map((category) => {
      const items = grouped[category] ?? [];
      const outlines = items
        .map(
          (source) =>
            `<outline text="${escapeXml(source.name)}" title="${escapeXml(source.name)}" type="rss" xmlUrl="${escapeXml(
              source.key
            )}" htmlUrl="${escapeXml(source.key)}" />`
        )
        .join('');
      return `<outline text="${escapeXml(category)}">${outlines}</outline>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="1.0"><head><title>${escapeXml(
    presetName
  )}</title></head><body>${body}</body></opml>`;
}

type ParsedOpmlSource = {
  key: string;
  name: string;
  categoryDefault: 'AI' | 'FE' | 'BE' | 'DEVOPS' | 'DATA' | 'SECURITY' | 'OTHER';
};

type ParsedOpmlResult = {
  sources: ParsedOpmlSource[];
  warnings: string[];
};

function normalizeCategory(value?: string | null): ParsedOpmlSource['categoryDefault'] | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (CATEGORY_SET.has(upper)) {
    if (upper === 'MISC' || upper === 'ETC') return 'OTHER';
    return upper as ParsedOpmlSource['categoryDefault'];
  }
  if (value.trim() === '기타') return 'OTHER';
  return null;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function parseOpml(text: string): ParsedOpmlResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ''
  });
  const result = parser.parse(text) as {
    opml?: { body?: { outline?: unknown } };
  };

  const warnings: string[] = [];
  const sources: ParsedOpmlSource[] = [];

  const walk = (outline: any, parentCategory: string | null) => {
    const outlines = toArray(outline);
    for (const node of outlines) {
      if (!node) continue;
      const xmlUrl = node.xmlUrl as string | undefined;
      const title = (node.title as string | undefined) ?? (node.text as string | undefined) ?? 'Untitled';
      const category = normalizeCategory(node.text ?? node.title) ?? parentCategory;

      if (xmlUrl) {
        const mappedCategory = category ?? 'FE';
        if (!category) {
          warnings.push(`category missing for ${xmlUrl}, defaulted to FE`);
        }
        sources.push({
          key: xmlUrl,
          name: title,
          categoryDefault: mappedCategory as ParsedOpmlSource['categoryDefault']
        });
      }

      if (node.outline) {
        walk(node.outline, category);
      }
    }
  };

  const rootOutline = (result.opml?.body?.outline ?? []) as unknown;
  walk(rootOutline, null);

  return { sources, warnings };
}
