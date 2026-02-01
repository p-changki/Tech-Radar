export type Post = {
  id: string;
  title: string;
  url: string;
  category: string;
  publishedAt: string;
  savedAt?: string;
  summaryTldr: string;
  summaryPoints?: string[];
  signals: string[];
  contentType?: string | null;
  status?: string | null;
  collection?: string | null;
  pinned?: boolean | null;
  whyItMatters?: string | null;
  summaryMeta?: Record<string, unknown> | null;
  tags?: string[];
  notes?: string | null;
};

export type PostsResponse = {
  posts: Post[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

export type SavedViewQuery = {
  q?: string;
  category?: string;
  contentType?: string;
  signal?: string;
  sort?: 'asc' | 'desc';
  status?: string;
  collection?: string;
  pinnedOnly?: string;
  lookbackDays?: string;
};

export type SavedView = {
  id: string;
  name: string;
  createdAt: string;
  query: SavedViewQuery;
};
