export function canonicalizeUrl(input: string): string {
  try {
    const url = new URL(input);

    url.hash = '';

    const params = new URLSearchParams(url.search);
    const keysToRemove: string[] = [];

    params.forEach((_value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.startsWith('utm_') ||
        lowerKey === 'ref' ||
        lowerKey === 'source' ||
        lowerKey === 'fbclid' ||
        lowerKey === 'gclid' ||
        lowerKey === 'mc_cid' ||
        lowerKey === 'mc_eid'
      ) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach((key) => params.delete(key));

    const sortedParams = new URLSearchParams();
    Array.from(params.keys())
      .sort()
      .forEach((key) => {
        const values = params.getAll(key);
        values.forEach((value) => sortedParams.append(key, value));
      });

    url.search = sortedParams.toString();

    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    url.hostname = url.hostname.toLowerCase();

    return url.toString();
  } catch {
    return input;
  }
}

export function getHostname(input: string): string | null {
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}

export function groupByHostname<T extends { key?: string; url?: string }>(
  sources: T[]
): Record<string, T[]> {
  return sources.reduce<Record<string, T[]>>((acc, source) => {
    const raw = source.key ?? source.url ?? '';
    const hostname = getHostname(raw) ?? 'unknown';
    acc[hostname] = acc[hostname] ?? [];
    acc[hostname].push(source);
    return acc;
  }, {});
}
