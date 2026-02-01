import { request } from 'undici';
import { httpAgent } from '../shared/httpAgent.js';

export type FetchFeedInput = {
  url: string;
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
  retryCount?: number;
};

export type FetchFeedResult = {
  status: number;
  etag?: string | null;
  lastModified?: string | null;
  text?: string;
  error?: string;
  finalUrl?: string;
  contentType?: string | null;
};

const DEFAULT_TIMEOUT_MS = 10000;
const USER_AGENT = 'tech-radar/0.1 (local dev)';

async function fetchOnce(input: FetchFeedInput, timeoutMs: number): Promise<FetchFeedResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept:
        'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    };

    if (input.etag) headers['If-None-Match'] = input.etag;
    if (input.lastModified) headers['If-Modified-Since'] = input.lastModified;

    const { statusCode, headers: resHeaders, body } = await request(input.url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      dispatcher: httpAgent
    });

    const status = statusCode;
    const etagHeader = resHeaders.etag;
    const lastModifiedHeader = resHeaders['last-modified'];
    const contentTypeHeader = resHeaders['content-type'];
    const etag = Array.isArray(etagHeader) ? etagHeader[0] : etagHeader ?? null;
    const lastModified = Array.isArray(lastModifiedHeader) ? lastModifiedHeader[0] : lastModifiedHeader ?? null;
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader ?? null;
    const finalUrl = input.url;

    if (status === 304) {
      return { status, etag, lastModified, finalUrl, contentType };
    }

    if (status < 200 || status >= 300) {
      return { status, etag, lastModified, finalUrl, contentType, error: `HTTP ${status}` };
    }

    const text = await body.text();
    return { status, etag, lastModified, text, finalUrl, contentType };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch failed';
    return { status: 0, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function tryFallback(input: FetchFeedInput, timeoutMs: number): Promise<FetchFeedResult> {
  if (!input.url.includes('blog.golang.org/feed.atom')) {
    return { status: 0, error: 'fallback not applicable' };
  }

  const fallbackUrl = 'https://go.dev/blog/feed.atom';
  return fetchOnce({ ...input, url: fallbackUrl }, timeoutMs);
}

export async function fetchFeed(input: FetchFeedInput): Promise<FetchFeedResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryCount = Math.max(0, input.retryCount ?? 1);

  let attempts = 0;
  let result = await fetchOnce(input, timeoutMs);

  if ((result.status === 0 || result.status >= 400) && input.url.includes('blog.golang.org')) {
    const fallback = await tryFallback(input, timeoutMs);
    if (fallback.status === 200 || fallback.status === 304) {
      return fallback;
    }
  }

  while ((result.status === 0 || result.status >= 500) && attempts < retryCount) {
    attempts += 1;
    result = await fetchOnce(input, timeoutMs);
  }

  return result;
}
