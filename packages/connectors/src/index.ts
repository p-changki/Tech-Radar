import pLimit from 'p-limit';
import {
  type Category,
  type FetchRunParams,
  type FetchedItemDTO,
  type RuleDTO,
  type SourceDTO,
  canonicalizeUrl,
  getHostname,
  normalizeFetchRunParams
} from '@tech-radar/shared';
import { detectContentType, detectSignals } from '@tech-radar/summarizer';
import { fetchFeed } from './rss/fetchFeed.js';
import { parseFeed } from './rss/parseFeed.js';
import { parseHtmlFeed } from './html/parseHtml.js';

const CATEGORY_SEEDS: Record<Category, string[]> = {
  AI: ['LLM', 'Agent', 'Model', 'Prompt'],
  FE: ['React', 'Next.js', 'CSS', 'UI'],
  BE: ['API', 'Database', 'Cache', 'Queue'],
  DEVOPS: ['Kubernetes', 'CI', 'Deployment', 'Observability'],
  DATA: ['Data', 'Pipeline', 'Analytics', 'Warehouse'],
  SECURITY: ['Security', 'Vulnerability', 'CVE', 'Patch'],
  OTHER: ['Update', 'Note', 'Insight', 'Misc']
};

const DEFAULT_CONCURRENCY = 6;
const DEFAULT_DOMAIN_CONCURRENCY = 2;
const DEFAULT_RECENT_DAYS = 14;
const DEFAULT_MAX_ITEMS_PER_SOURCE = 50;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY = 1;
const DEFAULT_HTML_FALLBACK_ENABLED = true;
const DEFAULT_HTML_MAX_PAGES = 3;

const shouldUseHtmlFallback = (params?: FetchRunParams) => {
  if (typeof params?.htmlFallback === 'boolean') {
    return params.htmlFallback;
  }
  const envValue = process.env.HTML_FALLBACK_ENABLED;
  if (typeof envValue === 'string') {
    return envValue.toLowerCase() !== 'false';
  }
  return DEFAULT_HTML_FALLBACK_ENABLED;
};

const getHtmlMaxPages = () => {
  const envValue = Number(process.env.HTML_FALLBACK_MAX_PAGES ?? DEFAULT_HTML_MAX_PAGES);
  if (!Number.isFinite(envValue) || envValue <= 0) return DEFAULT_HTML_MAX_PAGES;
  return Math.min(10, Math.max(1, Math.floor(envValue)));
};

const buildPagedUrl = (baseUrl: string, page: number) => {
  try {
    const url = new URL(baseUrl);
    if (url.searchParams.has('paged')) {
      url.searchParams.set('paged', String(page));
      return url.toString();
    }
    if (url.searchParams.has('page')) {
      url.searchParams.set('page', String(page));
      return url.toString();
    }
    const match = url.pathname.match(/\/page\/(\d+)\//);
    if (match) {
      url.pathname = url.pathname.replace(/\/page\/\d+\//, `/page/${page}/`);
      return url.toString();
    }
    url.searchParams.set('paged', String(page));
    return url.toString();
  } catch {
    return null;
  }
};

const fetchHtmlPage = async (url: string, timeoutMs: number, retryCount: number) => {
  const headers: Record<string, string> = {
    'User-Agent': 'tech-radar/0.1 (local dev)',
    Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
  };
  let attempts = 0;

  while (attempts <= retryCount) {
    attempts += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
      const status = response.status;
      const contentType = response.headers.get('content-type');
      const finalUrl = response.url || url;
      if (!response.ok) {
        if (status >= 500 && attempts <= retryCount) continue;
        return { status, contentType, finalUrl };
      }
      const text = await response.text();
      return { status, contentType, finalUrl, text };
    } catch {
      if (attempts > retryCount) {
        return { status: 0 };
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return { status: 0 };
};

function matchKeyword(pattern: string, target: string): boolean {
  const parts = pattern
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.some((part) => target.includes(part));
}

function matchRule(rule: RuleDTO, item: FetchedItemDTO, source?: SourceDTO | null): boolean {
  const target = `${item.title} ${item.snippet ?? ''} ${item.url}`.toLowerCase();
  const pattern = rule.pattern.toLowerCase();

  if (rule.type === 'keyword') {
    return matchKeyword(pattern, target);
  }

  if (rule.type === 'domain') {
    try {
      const hostname = new URL(item.url).hostname.toLowerCase();
      return matchKeyword(pattern, hostname);
    } catch {
      return false;
    }
  }

  if (rule.type === 'source') {
    return source?.name.toLowerCase().includes(pattern) ?? false;
  }

  return false;
}

function applyRules(
  rules: RuleDTO[],
  item: FetchedItemDTO,
  source?: SourceDTO | null
): { muted: boolean; scoreDelta: number } {
  let muted = false;
  let scoreDelta = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!matchRule(rule, item, source)) continue;

    if (rule.action === 'mute') {
      muted = true;
    }

    if (rule.action === 'boost') {
      scoreDelta += rule.weight;
    }
  }

  return { muted, scoreDelta };
}

function buildSnippet(category: Category, index: number, includeSignal: string | null): string {
  const seed = CATEGORY_SEEDS[category][index % CATEGORY_SEEDS[category].length];
  const signalText = includeSignal ? ` Includes ${includeSignal} details.` : '';
  return `${seed} update ${index + 1}. Short overview of changes and impact.${signalText}`;
}

function scoreItem(publishedAt: Date, source: SourceDTO | null, signals: string[]): number {
  const ageHours = (Date.now() - publishedAt.getTime()) / 3600000;
  const freshness = Math.max(0, 100 - ageHours * 2);
  const weightBoost = (source?.weight ?? 1) * 10;
  const signalBoost = signals.length * 6;
  return freshness + weightBoost + signalBoost;
}

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  AI: ['ai', 'ml', 'machine learning', 'deep learning', 'llm', 'genai', 'gpt', 'prompt', 'model', 'embedding'],
  FE: ['frontend', 'fe', 'react', 'next', 'next.js', 'css', 'javascript', 'typescript', 'web', 'ui', 'browser'],
  BE: ['backend', 'be', 'server', 'api', 'database', 'db', 'cache', 'queue', 'kafka', 'redis', 'postgres', 'mysql'],
  DEVOPS: [
    'devops',
    'kubernetes',
    'k8s',
    'docker',
    'ci',
    'cd',
    'infra',
    'sre',
    'cloud',
    'aws',
    'gcp',
    'azure',
    'terraform',
    'helm',
    'observability',
    'monitoring'
  ],
  DATA: [
    'data',
    'analytics',
    'warehouse',
    'etl',
    'elt',
    'pipeline',
    'dbt',
    'spark',
    'flink',
    'airflow',
    'bigquery',
    'snowflake',
    'redshift'
  ],
  SECURITY: ['security', 'secure', 'vulnerability', 'vuln', 'cve', 'patch', 'exploit', 'advisory', 'risk'],
  OTHER: []
};

const scoreCategory = (text: string, keywords: string[]) => {
  const lower = text.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (!keyword) continue;
    if (lower.includes(keyword)) score += 1;
  }
  return score;
};

const inferCategory = (
  title: string,
  snippet: string | null | undefined,
  tags: string[] | undefined,
  sourceCategory: Category
): Category => {
  const combined = `${title} ${snippet ?? ''}`.trim();
  const tagText = (tags ?? []).join(' ');
  const base = `${combined} ${tagText}`.trim();

  const scores = (Object.keys(CATEGORY_KEYWORDS) as Category[]).map((category) => ({
    category,
    score: scoreCategory(base, CATEGORY_KEYWORDS[category])
  }));

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  if (top && top.score > 0) return top.category;
  return sourceCategory;
};

function dedupeItems(items: FetchedItemDTO[]): FetchedItemDTO[] {
  const map = new Map<string, FetchedItemDTO>();

  for (const item of items) {
    const canonical = canonicalizeUrl(item.url);
    const existing = map.get(canonical);
    if (!existing || (item.score ?? 0) > (existing.score ?? 0)) {
      map.set(canonical, { ...item, url: canonical });
    }
  }

  return Array.from(map.values());
}

function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((tag) => typeof tag === 'string');
  }
  return [];
}

function groupByCategory(items: FetchedItemDTO[]): Record<Category, FetchedItemDTO[]> {
  return items.reduce<Record<Category, FetchedItemDTO[]>>(
    (acc, item) => {
      acc[item.category] = acc[item.category] ?? [];
      acc[item.category].push(item);
      return acc;
    },
    { AI: [], FE: [], BE: [], DEVOPS: [], DATA: [], SECURITY: [], OTHER: [] }
  );
}

function limitByCategory(
  items: FetchedItemDTO[],
  limits: Record<Category, number>
): Record<Category, FetchedItemDTO[]> {
  const grouped = groupByCategory(items);
  const result: Record<Category, FetchedItemDTO[]> = {
    AI: [],
    FE: [],
    BE: [],
    DEVOPS: [],
    DATA: [],
    SECURITY: [],
    OTHER: []
  };

  (Object.keys(limits) as Category[]).forEach((category) => {
    const sorted = (grouped[category] ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    result[category] = sorted.slice(0, limits[category]);
  });

  return result;
}

export type FetchItemsInput = {
  params?: FetchRunParams;
  sources: SourceDTO[];
  rules: RuleDTO[];
  domainConcurrency?: Record<string, number>;
};

export type SourceFetchReport = {
  sourceId: string;
  name: string;
  hostname: string;
  status: number;
  fetchedCount: number;
  latencyMs: number;
  domainConcurrencyApplied: 1 | 2;
  error?: string;
  etag?: string | null;
  lastModified?: string | null;
  finalUrl?: string | null;
  usedHtmlFallback?: boolean;
};

export type FetchItemsOutput = {
  itemsByCategory: Record<Category, FetchedItemDTO[]>;
  sourceReports: SourceFetchReport[];
};

export function fetchItemsDummy({ params, sources, rules }: FetchItemsInput): FetchItemsOutput {
  const { limits } = normalizeFetchRunParams(params);
  const items: FetchedItemDTO[] = [];
  const now = Date.now();
  const signalsCycle = ['CVE', 'breaking', 'deprecated', 'release', 'performance'];

  (Object.keys(limits) as Category[]).forEach((category, categoryIndex) => {
    const limit = limits[category];
    const categorySources = sources.filter(
      (source) => source.enabled && source.categoryDefault === category
    );

    for (let i = 0; i < limit; i += 1) {
      const includeSignal =
        i === 0 ? (signalsCycle[categoryIndex % signalsCycle.length] ?? null) : null;
      const seed = CATEGORY_SEEDS[category][i % CATEGORY_SEEDS[category].length];
      const title = `${seed} ${includeSignal ? includeSignal.toUpperCase() : 'update'} in ${category}`;
      const snippet = buildSnippet(category, i, includeSignal);
      const url = `https://example.com/${category.toLowerCase()}/${now}-${categoryIndex}-${i}`;
      const publishedAt = new Date(now - (categoryIndex * 3600 + i * 900) * 1000);
      const signals = detectSignals(`${title} ${snippet}`);
      let score = 100 - i * 3 - categoryIndex * 2 + signals.length * 10;

      const source = categorySources[i % Math.max(categorySources.length, 1)] ?? null;
      const item: FetchedItemDTO = {
        category,
        sourceId: source?.id ?? null,
        title,
        url,
        publishedAt,
        snippet,
        contentTypeHint: detectContentType({
          title,
          url,
          snippet,
          sourceName: source?.name ?? null,
          sourceTags: parseTags(source?.tags)
        }),
        signals,
        score,
        raw: {
          seed,
          category,
          sourceKey: source?.key ?? null,
          sourceUrl: source?.key ?? null,
          originalLink: url
        }
      };

      const ruleResult = applyRules(rules, item, source);
      if (ruleResult.muted) continue;

      score += ruleResult.scoreDelta;
      item.score = score;

      items.push(item);
    }
  });

  const limitedItems = limitByCategory(dedupeItems(items), limits);

  return {
    itemsByCategory: limitedItems,
    sourceReports: []
  };
}

export async function fetchItemsReal({
  params,
  sources,
  rules,
  domainConcurrency
}: FetchItemsInput): Promise<FetchItemsOutput> {
  const normalized = normalizeFetchRunParams(params);
  const { limits } = normalized;
  const concurrency = Number(process.env.FETCH_CONCURRENCY ?? DEFAULT_CONCURRENCY);
  const domainConcurrencyLimit = Number(process.env.FETCH_DOMAIN_CONCURRENCY ?? DEFAULT_DOMAIN_CONCURRENCY);
  const recentDays =
    normalized.lookbackDays ??
    Number(process.env.LOOKBACK_DAYS ?? DEFAULT_RECENT_DAYS);
  const maxItemsPerSource = Number(process.env.MAX_ITEMS_PER_SOURCE ?? DEFAULT_MAX_ITEMS_PER_SOURCE);
  const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const retryCount = Number(process.env.FETCH_RETRY ?? DEFAULT_RETRY);
  const htmlFallbackEnabled = shouldUseHtmlFallback(params);
  const htmlMaxPages = getHtmlMaxPages();
  const limit = pLimit(Number.isFinite(concurrency) && concurrency > 0 ? concurrency : DEFAULT_CONCURRENCY);
  const domainLimitSize =
    Number.isFinite(domainConcurrencyLimit) && domainConcurrencyLimit > 0
      ? domainConcurrencyLimit
      : DEFAULT_DOMAIN_CONCURRENCY;
  const maxPerSource = Number.isFinite(maxItemsPerSource) && maxItemsPerSource > 0 ? maxItemsPerSource : DEFAULT_MAX_ITEMS_PER_SOURCE;
  const cutoff = Date.now() - recentDays * 24 * 60 * 60 * 1000;

  const enabledSources = sources.filter((source) => source.enabled);

  const domainLimits = new Map<string, ReturnType<typeof pLimit>>();
  const domainInFlight = new Map<string, number>();

  const sourceResults = await Promise.all(
    enabledSources.map((source) =>
      limit(async () => {
        const hostname = getHostname(source.key) ?? 'unknown';
        const appliedConcurrency = Math.min(
          domainLimitSize,
          Math.max(1, domainConcurrency?.[hostname] ?? domainLimitSize)
        ) as 1 | 2;
        const domainLimiter =
          domainLimits.get(hostname) ?? pLimit(appliedConcurrency);
        domainLimits.set(hostname, domainLimiter);

        return domainLimiter(async () => {
          const inFlight = (domainInFlight.get(hostname) ?? 0) + 1;
          domainInFlight.set(hostname, inFlight);
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.log(`[fetch] hostname=${hostname} inFlight=${inFlight}`);
          }

          const startedAt = Date.now();
          try {
            const fetchResult = await fetchFeed({
              url: source.key,
              etag: source.etag ?? null,
              lastModified: source.lastModified ?? null,
              timeoutMs,
              retryCount
            });
            const latencyMs = Date.now() - startedAt;

            if (fetchResult.status === 304) {
              return {
                sourceId: source.id,
                name: source.name,
                hostname,
                status: 304,
                fetchedCount: 0,
                latencyMs,
                domainConcurrencyApplied: appliedConcurrency,
                etag: fetchResult.etag ?? null,
                lastModified: fetchResult.lastModified ?? null,
                finalUrl: fetchResult.finalUrl ?? null
              } satisfies SourceFetchReport;
            }

            if (fetchResult.status !== 200 || !fetchResult.text) {
              return {
                sourceId: source.id,
                name: source.name,
                hostname,
                status: fetchResult.status,
                fetchedCount: 0,
                latencyMs,
                domainConcurrencyApplied: appliedConcurrency,
                error: fetchResult.error ?? 'fetch failed',
                etag: fetchResult.etag ?? null,
                lastModified: fetchResult.lastModified ?? null,
                finalUrl: fetchResult.finalUrl ?? null
              } satisfies SourceFetchReport;
            }

            try {
              const contentType = fetchResult.contentType ?? '';
              const looksLikeHtml =
                contentType.includes('text/html') || /<html|<!doctype html/i.test(fetchResult.text);
              let parsedItems: ReturnType<typeof parseHtmlFeed> = [];
              let usedHtmlFallback = false;
              let htmlBaseUrl = fetchResult.finalUrl ?? source.key;
              let htmlText: string | null = null;

              try {
                parsedItems = await parseFeed(fetchResult.text);
              } catch (error) {
                if (htmlFallbackEnabled) {
                  if (looksLikeHtml) {
                    htmlText = fetchResult.text;
                  } else {
                    const htmlResult = await fetchHtmlPage(htmlBaseUrl, timeoutMs, retryCount);
                    if (htmlResult.text && (htmlResult.contentType?.includes('text/html') || /<html|<!doctype html/i.test(htmlResult.text))) {
                      htmlText = htmlResult.text;
                      htmlBaseUrl = htmlResult.finalUrl ?? htmlBaseUrl;
                    }
                  }

                  if (htmlText) {
                    parsedItems = parseHtmlFeed(htmlText, htmlBaseUrl);
                    usedHtmlFallback = true;
                  } else {
                    throw error;
                  }
                } else {
                  throw error;
                }
              }

              if (htmlFallbackEnabled && parsedItems.length === 0) {
                if (!htmlText && looksLikeHtml) {
                  htmlText = fetchResult.text;
                }
                if (!htmlText) {
                  const htmlResult = await fetchHtmlPage(htmlBaseUrl, timeoutMs, retryCount);
                  if (htmlResult.text && (htmlResult.contentType?.includes('text/html') || /<html|<!doctype html/i.test(htmlResult.text))) {
                    htmlText = htmlResult.text;
                    htmlBaseUrl = htmlResult.finalUrl ?? htmlBaseUrl;
                  }
                }
                if (htmlText) {
                  parsedItems = parseHtmlFeed(htmlText, htmlBaseUrl);
                  usedHtmlFallback = true;
                }
              }

              if (htmlFallbackEnabled && usedHtmlFallback && htmlMaxPages > 1 && parsedItems.length < maxPerSource) {
                const collected = new Map<string, ReturnType<typeof parseHtmlFeed>[number]>();
                for (const item of parsedItems) {
                  if (item.link) {
                    collected.set(item.link, item);
                  }
                }
                const visited = new Set<string>();
                visited.add(htmlBaseUrl);

                for (let page = 2; page <= htmlMaxPages && collected.size < maxPerSource; page += 1) {
                  const nextUrl = buildPagedUrl(htmlBaseUrl, page);
                  if (!nextUrl || visited.has(nextUrl)) break;
                  visited.add(nextUrl);
                  const pageResult = await fetchHtmlPage(nextUrl, timeoutMs, retryCount);
                  if (!pageResult.text) continue;
                  const pageItems = parseHtmlFeed(pageResult.text, pageResult.finalUrl ?? nextUrl);
                  if (pageItems.length === 0) break;
                  for (const item of pageItems) {
                    if (!item.link || collected.size >= maxPerSource) continue;
                    collected.set(item.link, item);
                  }
                }
                parsedItems = Array.from(collected.values());
              }
              const preparedItems = parsedItems
                .filter((item) => item.publishedAt)
                .sort((a, b) => {
                  const left = a.publishedAt ? a.publishedAt.getTime() : 0;
                  const right = b.publishedAt ? b.publishedAt.getTime() : 0;
                  return right - left;
                })
                .slice(0, maxPerSource)
                .filter((item) => {
                  const publishedAt = item.publishedAt;
                  if (!publishedAt) return false;
                  return publishedAt.getTime() >= cutoff;
                });

              const normalizedItems = preparedItems
                .map((item) => {
                  const publishedAt = item.publishedAt;
                  if (!publishedAt) return null;

                  const link = item.link;
                  const signals = detectSignals(`${item.title} ${item.snippet ?? ''}`);
                  let score = scoreItem(publishedAt, source, signals);
                  const inferredCategory = inferCategory(
                    item.title,
                    item.snippet ?? null,
                    item.categories,
                    source.categoryDefault
                  );

                  const result: FetchedItemDTO = {
                    category: inferredCategory,
                    sourceId: source.id,
                    title: item.title,
                    url: link,
                    publishedAt,
                    snippet: item.snippet ?? null,
                    contentTypeHint: detectContentType({
                      title: item.title,
                      url: link,
                      snippet: item.snippet ?? null,
                      sourceName: source.name,
                      sourceTags: parseTags(source.tags)
                    }),
                    signals,
                    score,
                    raw: {
                      sourceUrl: source.key,
                      sourceKey: source.key,
                      originalLink: link,
                      guid: item.guid ?? null,
                      ...item.raw
                    }
                  };

                  const ruleResult = applyRules(rules, result, source);
                  if (ruleResult.muted) return null;

                  score += ruleResult.scoreDelta;
                  result.score = score;

                  return result;
                })
                .filter(Boolean) as FetchedItemDTO[];

              return {
                sourceId: source.id,
                name: source.name,
                hostname,
                status: 200,
                fetchedCount: normalizedItems.length,
                latencyMs,
                domainConcurrencyApplied: appliedConcurrency,
                etag: fetchResult.etag ?? null,
                lastModified: fetchResult.lastModified ?? null,
                finalUrl: fetchResult.finalUrl ?? null,
                usedHtmlFallback,
                items: normalizedItems
              };
            } catch (error) {
              return {
                sourceId: source.id,
                name: source.name,
                hostname,
                status: 500,
                fetchedCount: 0,
                latencyMs,
                domainConcurrencyApplied: appliedConcurrency,
                error: error instanceof Error ? error.message : 'parse failed',
                etag: fetchResult.etag ?? null,
                lastModified: fetchResult.lastModified ?? null,
                finalUrl: fetchResult.finalUrl ?? null
              } satisfies SourceFetchReport;
            }
          } finally {
            const next = Math.max(0, (domainInFlight.get(hostname) ?? 1) - 1);
            domainInFlight.set(hostname, next);
          }
        });
      })
    )
  );

  const items = dedupeItems(
    sourceResults.flatMap((result) => ('items' in result ? (result.items as FetchedItemDTO[]) : []))
  );

  return {
    itemsByCategory: limitByCategory(items, limits),
    sourceReports: sourceResults.map((result) => ({
      sourceId: result.sourceId,
      name: result.name,
      hostname: result.hostname,
      status: result.status,
      fetchedCount: result.fetchedCount,
      latencyMs: result.latencyMs,
      domainConcurrencyApplied: result.domainConcurrencyApplied,
      error: result.error,
      etag: result.etag ?? null,
      lastModified: result.lastModified ?? null,
      finalUrl: result.finalUrl ?? null,
      usedHtmlFallback: result.usedHtmlFallback
    }))
  };
}
