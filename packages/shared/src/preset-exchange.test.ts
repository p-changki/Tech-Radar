import { describe, expect, it } from 'vitest';
import { ExportPresetV1Schema, buildOpml, parseOpml } from './preset-exchange.js';

describe('ExportPresetV1Schema', () => {
  it('validates a preset payload', () => {
    const payload = {
      version: 'preset-v1',
      exportedAt: new Date().toISOString(),
      preset: {
        name: 'Example Preset',
        description: 'demo'
      },
      sources: [
        {
          key: 'https://example.com/rss.xml',
          name: 'Example',
          type: 'rss',
          categoryDefault: 'AI',
          locale: 'en',
          enabled: false,
          weight: 1,
          tags: ['news']
        }
      ]
    };

    const parsed = ExportPresetV1Schema.parse(payload);
    expect(parsed.preset.name).toBe('Example Preset');
  });
});

describe('OPML roundtrip', () => {
  it('preserves feed urls through opml', () => {
    const sources = [
      {
        key: 'https://example.com/rss.xml',
        name: 'Example',
        type: 'rss' as const,
        categoryDefault: 'AI' as const
      },
      {
        key: 'https://k8s.io/feed.xml',
        name: 'Kubernetes',
        type: 'rss' as const,
        categoryDefault: 'DEVOPS' as const
      }
    ];

    const opml = buildOpml('Demo', sources);
    const parsed = parseOpml(opml);
    const urls = parsed.sources.map((source) => source.key).sort();
    expect(urls).toEqual(['https://example.com/rss.xml', 'https://k8s.io/feed.xml']);
  });
});
