import assert from 'node:assert/strict';
import { detectContentType, summarize } from './index';

const releaseInput = {
  title: 'Release v2.1.0 - Breaking Changes',
  url: 'https://github.com/org/repo/releases/tag/v2.1.0',
  snippet: 'Breaking changes: API v2 migration required.'
};

assert.equal(detectContentType({ ...releaseInput, sourceName: 'GitHub', sourceTags: [] }), 'RELEASE_NOTE');

const releaseSummary = summarize({ ...releaseInput, rawText: releaseInput.snippet });
assert.equal(releaseSummary.contentType, 'RELEASE_NOTE');
assert.equal((releaseSummary.summaryMeta as { versionDetected?: string }).versionDetected, 'v2.1.0');

const blogInput = {
  title: 'Kubernetes로 서비스 배포 개선하기',
  url: 'https://techblog.woowahan.com/1234',
  snippet: '우리는 Kubernetes와 PostgreSQL 기반으로 배포 파이프라인을 개선했습니다.'
};

assert.equal(
  detectContentType({ ...blogInput, sourceName: '우아한형제들 기술블로그', sourceTags: ['company'] }),
  'COMPANY_BLOG'
);

const blogSummary = summarize({ ...blogInput, rawText: blogInput.snippet });
const blogMeta = blogSummary.summaryMeta as { stackHints?: string[] };
assert.equal(blogSummary.contentType, 'COMPANY_BLOG');
assert.ok(blogMeta.stackHints?.includes('Kubernetes'));

const newsInput = {
  title: '[뉴스] OpenAI updates pricing',
  url: 'https://news.hada.io/123',
  snippet: '요약형 뉴스입니다.'
};

assert.equal(detectContentType({ ...newsInput, sourceName: 'GeekNews', sourceTags: ['news'] }), 'NEWS');

const newsSummary = summarize({ ...newsInput, rawText: newsInput.snippet, sourceTags: ['news'] });
const newsMeta = newsSummary.summaryMeta as { keywords?: string[] };
assert.equal(newsSummary.contentType, 'NEWS');
assert.ok((newsMeta.keywords?.length ?? 0) > 0);

console.log('summarizer unit tests passed');
