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

    const response = await fetch(input.url, {
      headers,
      signal: controller.signal,
      redirect: 'follow'
    });

    const status = response.status;
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    const finalUrl = response.url || input.url;
    const contentType = response.headers.get('content-type');

    if (status === 304) {
      return { status, etag, lastModified, finalUrl, contentType };
    }

    if (!response.ok) {
      return { status, etag, lastModified, finalUrl, contentType, error: `HTTP ${status}` };
    }

    const text = await response.text();
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
