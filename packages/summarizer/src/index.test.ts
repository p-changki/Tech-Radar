import { describe, expect, it } from 'vitest';
import { detectContentType, summarize } from './index.js';

describe('summarizer content types', () => {
  it('detects release notes and extracts version', () => {
    const input = {
      title: 'Release v2.1.0 - Breaking Changes',
      url: 'https://github.com/org/repo/releases/tag/v2.1.0',
      snippet: 'Breaking changes: API v2 migration required.'
    };

    expect(detectContentType({ ...input, sourceName: 'GitHub', sourceTags: [] })).toBe('RELEASE_NOTE');

    const summary = summarize({ ...input, rawText: input.snippet });
    expect(summary.contentType).toBe('RELEASE_NOTE');
    expect((summary.summaryMeta as { versionDetected?: string }).versionDetected).toBe('v2.1.0');
  });

  it('detects company blog and extracts stack hints', () => {
    const input = {
      title: 'Kubernetes로 서비스 배포 개선하기',
      url: 'https://techblog.woowahan.com/1234',
      snippet: '우리는 Kubernetes와 PostgreSQL 기반으로 배포 파이프라인을 개선했습니다.'
    };

    expect(detectContentType({ ...input, sourceName: '우아한형제들 기술블로그', sourceTags: ['company'] })).toBe(
      'COMPANY_BLOG'
    );

    const summary = summarize({ ...input, rawText: input.snippet });
    const meta = summary.summaryMeta as { stackHints?: string[] };
    expect(summary.contentType).toBe('COMPANY_BLOG');
    expect(meta.stackHints).toContain('Kubernetes');
  });

  it('detects news and generates keywords', () => {
    const input = {
      title: '[뉴스] OpenAI updates pricing',
      url: 'https://news.hada.io/123',
      snippet: '요약형 뉴스입니다.'
    };

    expect(detectContentType({ ...input, sourceName: 'GeekNews', sourceTags: ['news'] })).toBe('NEWS');

    const summary = summarize({ ...input, rawText: input.snippet, sourceTags: ['news'] });
    const meta = summary.summaryMeta as { keywords?: string[] };
    expect(summary.contentType).toBe('NEWS');
    expect(meta.keywords && meta.keywords.length > 0).toBe(true);
  });
});
