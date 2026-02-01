import { load } from 'cheerio';
import type { ParsedFeedItem } from '../rss/parseFeed.js';

type HtmlRule = {
  container: string;
  title: string;
  snippet?: string;
  date?: string;
};

const HOST_RULES: Record<string, HtmlRule> = {
  'techblog.woowahan.com': {
    container: '.post-item',
    title: '.post-title',
    snippet: '.post-excerpt',
    date: '.post-author-date, time'
  }
};

const DATE_PATTERNS = [
  /(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/, // 2025-12-11 / 2025.12.11 / 2025/12/11
  /([A-Za-z]{3,9})\.?\s*(\d{1,2})[,\s.]+(20\d{2})/, // Dec.26.2025 / Dec 26 2025
  /(20\d{2})(\d{2})(\d{2})/ // 20251211
];

const URL_DATE_PATTERNS = [
  /\/(20\d{2})\/(\d{1,2})\/(\d{1,2})\//,
  /(20\d{2})-(\d{2})-(\d{2})/
];

const parseDateFromText = (value: string | null | undefined) => {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const monthMatch = normalized.match(DATE_PATTERNS[1]);
  if (monthMatch) {
    const monthMap: Record<string, number> = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12
    };
    const monthName = monthMatch[1]?.toLowerCase() ?? '';
    const month = monthMap[monthName];
    const day = Number(monthMatch[2]);
    const year = Number(monthMatch[3]);
    if (month) {
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  for (const pattern of DATE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
};

const parseDateFromUrl = (url: string) => {
  for (const pattern of URL_DATE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
};

const resolveUrl = (href: string, baseUrl: string) => {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
};

export function parseHtmlFeed(text: string, baseUrl: string): ParsedFeedItem[] {
  const $ = load(text);
  let host = '';
  try {
    host = new URL(baseUrl).hostname.replace(/^www\./, '');
  } catch {
    host = '';
  }
  const rule = host ? HOST_RULES[host] : undefined;

  let containers = rule ? $(rule.container) : $('article');

  if (containers.length === 0) {
    containers = $('[class*="post"], [class*="entry"], [class*="article"]');
  }

  const items: ParsedFeedItem[] = [];

  containers.each((_, element) => {
    const node = $(element);
    const headingNode = rule ? node.find(rule.title).first() : node.find('h1 a, h2 a, h3 a').first();
    const linkElement = headingNode.length && headingNode.is('a') ? headingNode : node.find('a').first();
    const href = linkElement.attr('href');
    const headingText = headingNode.text().trim();
    const title =
      headingText || linkElement.text().trim() || node.find('h1,h2,h3').first().text().trim();

    if (!href || !title) return;

    const url = resolveUrl(href, baseUrl);
    const timeElement = rule && rule.date ? node.find(rule.date).first() : node.find('time').first();
    const datetimeAttr = timeElement.attr('datetime');
    const timeText = timeElement.text();
    const classDateText = rule && rule.date
      ? node.find(rule.date).first().text()
      : node.find('[class*="date"], [class*="time"], [class*="meta"]').first().text();

    const publishedAt =
      parseDateFromText(datetimeAttr) ||
      parseDateFromText(timeText) ||
      parseDateFromText(classDateText) ||
      parseDateFromUrl(url) ||
      null;

    const snippet = (rule && rule.snippet ? node.find(rule.snippet) : node.find('p')).first().text().trim() || null;

    items.push({
      title,
      link: url,
      guid: null,
      publishedAt,
      snippet,
      raw: {
        sourceType: 'html',
        linkText: linkElement.text().trim() || null
      }
    });
  });

  return items;
}
