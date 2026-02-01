import pLimit from 'p-limit';

const FEED_TYPES = [
  'application/rss+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml',
  'application/feed+xml'
];

type DiscoverResult = { feeds: string[]; finalUrl: string };

const CACHE_TTL_MS = 10 * 60 * 1000;
const discoveryCache = new Map<string, { expiresAt: number; value: DiscoverResult }>();

const isFeedContentType = (value?: string | null) => {
  if (!value) return false;
  return FEED_TYPES.some((type) => value.toLowerCase().includes(type));
};

const bodyLooksLikeFeed = (text: string) => /<rss\b|<feed\b|<rdf:RDF\b/i.test(text);

const fetchWithTimeout = async (url: string, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'tech-radar/0.1' } });
  } finally {
    clearTimeout(timeout);
  }
};

const extractFeedLinks = (html: string, baseUrl: string) => {
  const links = html.match(/<link\s+[^>]*>/gi) ?? [];
  const results: string[] = [];
  for (const link of links) {
    const attrs: Record<string, string> = {};
    const attrMatches = link.match(/(\w+)\s*=\s*(['"])(.*?)\2/g) ?? [];
    for (const attr of attrMatches) {
      const [, key, , value] = attr.match(/(\w+)\s*=\s*(['"])(.*?)\2/) ?? [];
      if (key && value) attrs[key.toLowerCase()] = value;
    }
    const rel = attrs.rel?.toLowerCase() ?? '';
    const type = attrs.type?.toLowerCase() ?? '';
    const href = attrs.href;
    if (!href) continue;
    if (!rel.includes('alternate')) continue;
    if (!type.includes('rss') && !type.includes('atom') && !type.includes('xml')) continue;
    try {
      results.push(new URL(href, baseUrl).toString());
    } catch {
      // ignore invalid urls
    }
  }
  return Array.from(new Set(results));
};

const buildFeedGuesses = (inputUrl: string) => {
  const url = new URL(inputUrl);
  const origin = url.origin;
  const path = url.pathname.endsWith('/') ? url.pathname : url.pathname.replace(/\/+[^/]*$/, '/');
  const candidates = new Set<string>();
  const suffixes = ['feed', 'feed.xml', 'rss', 'rss.xml', 'atom.xml', 'index.xml'];
  for (const suffix of suffixes) {
    candidates.add(`${origin}/${suffix}`);
    candidates.add(`${origin}${path}${suffix}`);
  }
  return Array.from(candidates);
};

const buildQueryFeedGuesses = (inputUrl: string) => {
  const url = new URL(inputUrl);
  const candidates = new Set<string>();
  if (url.search) {
    const withFeedRss2 = new URL(inputUrl);
    if (!withFeedRss2.searchParams.has('feed')) {
      withFeedRss2.searchParams.set('feed', 'rss2');
      candidates.add(withFeedRss2.toString());
      const withFeedRss = new URL(inputUrl);
      withFeedRss.searchParams.set('feed', 'rss');
      candidates.add(withFeedRss.toString());
    }
    const feedPath = new URL(inputUrl);
    feedPath.pathname = feedPath.pathname.endsWith('/') ? `${feedPath.pathname}feed/` : `${feedPath.pathname}/feed/`;
    candidates.add(feedPath.toString());
  }
  return Array.from(candidates);
};

const getCached = (key: string) => {
  const cached = discoveryCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    discoveryCache.delete(key);
    return null;
  }
  return cached.value;
};

const setCached = (key: string, value: DiscoverResult) => {
  discoveryCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
};

export const discoverFeeds = async (inputUrl: string) => {
  const cached = getCached(inputUrl);
  if (cached) return cached;

  const response = await fetchWithTimeout(inputUrl);
  const finalUrl = response.url || inputUrl;
  const contentType = response.headers.get('content-type');
  const text = await response.text();

  if (isFeedContentType(contentType) && bodyLooksLikeFeed(text)) {
    const result = { feeds: [finalUrl], finalUrl };
    setCached(inputUrl, result);
    return result;
  }

  const discovered = extractFeedLinks(text, finalUrl);
  if (discovered.length > 0) {
    const result = { feeds: discovered, finalUrl };
    setCached(inputUrl, result);
    return result;
  }

  const guesses = Array.from(new Set([...buildFeedGuesses(finalUrl), ...buildQueryFeedGuesses(finalUrl)])).slice(0, 12);
  const limit = pLimit(5);
  const results = await Promise.allSettled(
    guesses.map((candidate) =>
      limit(async () => {
        const feedRes = await fetchWithTimeout(candidate, 6000);
        const feedType = feedRes.headers.get('content-type');
        const feedText = await feedRes.text();
        if (isFeedContentType(feedType) && bodyLooksLikeFeed(feedText)) {
          return feedRes.url || candidate;
        }
        return null;
      })
    )
  );

  const found = results
    .filter((result): result is PromiseFulfilledResult<string | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((value): value is string => value !== null);

  const result = { feeds: Array.from(new Set(found)), finalUrl };
  setCached(inputUrl, result);
  return result;
};
