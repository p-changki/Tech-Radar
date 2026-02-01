export type DomainStatSample = {
  ok: boolean;
  latencyMs: number;
  status?: number;
  at: string;
};

export type DomainStatLike = {
  hostname: string;
  windowSize: number;
  samples: unknown;
  avgLatencyMs: number;
  failRate: number;
  consecutiveFailures: number;
};

export type DomainStatPatch = {
  lastUpdatedAt: Date;
  windowSize: number;
  samples: DomainStatSample[];
  avgLatencyMs: number;
  failRate: number;
  consecutiveFailures: number;
};

function parseSamples(input: unknown): DomainStatSample[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const ok = Boolean(record.ok);
      const latencyMs = typeof record.latencyMs === 'number' ? record.latencyMs : 0;
      const status = typeof record.status === 'number' ? record.status : undefined;
      const at = typeof record.at === 'string' ? record.at : new Date().toISOString();
      return { ok, latencyMs, status, at } satisfies DomainStatSample;
    })
    .filter(Boolean) as DomainStatSample[];
}

function computeConsecutiveFailures(samples: DomainStatSample[]): number {
  let count = 0;
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    if (samples[i]?.ok) break;
    count += 1;
  }
  return count;
}

export function updateDomainStat(
  prev: DomainStatLike | null,
  sample: { ok: boolean; latencyMs: number; status?: number }
): DomainStatPatch {
  const windowSize = prev?.windowSize ?? 10;
  const currentSamples = parseSamples(prev?.samples);
  const nextSamples = [...currentSamples, { ...sample, at: new Date().toISOString() }];
  const trimmed = nextSamples.slice(-windowSize);

  const avgLatencyMs =
    trimmed.length === 0
      ? 0
      : Math.round(trimmed.reduce((sum, item) => sum + item.latencyMs, 0) / trimmed.length);
  const failRate = trimmed.length === 0 ? 0 : trimmed.filter((item) => !item.ok).length / trimmed.length;
  const consecutiveFailures = computeConsecutiveFailures(trimmed);

  return {
    lastUpdatedAt: new Date(),
    windowSize,
    samples: trimmed,
    avgLatencyMs,
    failRate,
    consecutiveFailures
  };
}

export function computeDomainConcurrency(
  stat: DomainStatLike | null,
  defaults: { base: 2; degraded: 1 }
): 1 | 2 {
  if (!stat) return defaults.base;

  const shouldDegrade =
    stat.failRate >= 0.3 || stat.avgLatencyMs >= 5000 || stat.consecutiveFailures >= 3;
  const shouldRecover =
    stat.failRate < 0.2 && stat.avgLatencyMs < 4000 && stat.consecutiveFailures === 0;

  if (shouldDegrade) return defaults.degraded;
  if (shouldRecover) return defaults.base;

  return defaults.degraded;
}
