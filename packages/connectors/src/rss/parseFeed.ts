import Parser from 'rss-parser';

export type ParsedFeedItem = {
  title: string;
  link: string;
  guid?: string | null;
  publishedAt: Date | null;
  snippet?: string | null;
  categories?: string[];
  raw: Record<string, unknown>;
};

const parser = new Parser({
  customFields: {
    item: ['summary', 'content', 'contentSnippet', 'content:encoded']
  }
});

export async function parseFeed(text: string): Promise<ParsedFeedItem[]> {
  const feed = await parser.parseString(text);

  return (feed.items ?? [])
    .map((item) => {
      const link = item.link || item.guid || '';
      const title = item.title || item.pubDate || 'Untitled';
      const categories = Array.isArray(item.categories)
        ? item.categories.filter((value) => typeof value === 'string')
        : typeof item.category === 'string'
          ? [item.category]
          : [];
      const snippet =
        (item as { summary?: string }).summary ||
        item.contentSnippet ||
        item.content ||
        null;
      const raw = {
        guid: item.guid ?? null,
        isoDate: item.isoDate ?? null,
        pubDate: item.pubDate ?? null,
        categories
      };

      const dateString = item.isoDate || item.pubDate || '';
      const publishedAt = dateString ? new Date(dateString) : null;

      return {
        title,
        link,
        guid: item.guid ?? null,
        publishedAt,
        snippet,
        categories: categories.length ? categories : undefined,
        raw
      };
    })
    .filter((item) => item.link && item.title);
}
