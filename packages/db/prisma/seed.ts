import { prisma } from '../src/client.js';

type SeedSource = {
  name: string;
  key: string;
  categoryDefault: 'AI' | 'FE' | 'BE' | 'DEVOPS';
  locale: 'ko' | 'en';
  tags: string[];
  weight?: number;
  enabled?: boolean;
};

const koreaSources: SeedSource[] = [
  {
    name: 'GeekNews',
    key: 'https://news.hada.io/rss/news',
    categoryDefault: 'AI',
    locale: 'ko',
    tags: ['news', 'korea']
  },
  {
    name: 'NAVER D2',
    key: 'https://d2.naver.com/d2.atom',
    categoryDefault: 'FE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '우아한형제들 기술블로그',
    key: 'https://techblog.woowahan.com/feed/',
    categoryDefault: 'BE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '토스 테크',
    key: 'https://toss.tech/rss.xml',
    categoryDefault: 'FE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '컬리 기술블로그',
    key: 'https://helloworld.kurly.com/feed.xml',
    categoryDefault: 'BE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '카카오엔터프라이즈 Tech&',
    key: 'https://tech.kakaoenterprise.com/feed',
    categoryDefault: 'FE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '데브시스터즈 기술블로그',
    key: 'https://tech.devsisters.com/rss.xml',
    categoryDefault: 'BE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: 'NHN Cloud Meetup',
    key: 'https://meetup.toast.com/rss',
    categoryDefault: 'DEVOPS',
    locale: 'ko',
    tags: ['community', 'korea']
  },
  {
    name: '쏘카 기술블로그',
    key: 'https://tech.socarcorp.kr/feed',
    categoryDefault: 'FE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '요기요 기술블로그',
    key: 'https://techblog.yogiyo.co.kr/feed',
    categoryDefault: 'BE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: 'Hyperconnect',
    key: 'https://hyperconnect.github.io/feed.xml',
    categoryDefault: 'DEVOPS',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '기억보단 기록을 (jojoldu)',
    key: 'https://jojoldu.tistory.com/rss',
    categoryDefault: 'BE',
    locale: 'ko',
    tags: ['personal', 'korea']
  },
  {
    name: 'Java Can Do IT',
    key: 'https://javacan.tistory.com/rss',
    categoryDefault: 'BE',
    locale: 'ko',
    tags: ['personal', 'korea']
  },
  {
    name: 'Yun Blog (cheese10yun)',
    key: 'https://cheese10yun.github.io/feed.xml',
    categoryDefault: 'BE',
    locale: 'ko',
    tags: ['personal', 'korea']
  },
  {
    name: '무신사 테크',
    key: 'https://medium.com/feed/musinsa-tech',
    categoryDefault: 'FE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '당근 테크',
    key: 'https://medium.com/feed/daangn',
    categoryDefault: 'FE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '쿠팡 엔지니어링',
    key: 'https://medium.com/feed/coupang-engineering',
    categoryDefault: 'BE',
    locale: 'ko',
    tags: ['company', 'korea']
  },
  {
    name: '뱅크샐러드',
    key: 'https://blog.banksalad.com/rss.xml',
    categoryDefault: 'BE',
    locale: 'ko',
    tags: ['company', 'korea']
  }
];

const globalSources: SeedSource[] = [
  {
    name: 'OpenAI News',
    key: 'https://openai.com/news/rss.xml',
    categoryDefault: 'AI',
    locale: 'en',
    tags: ['global', 'official'],
    weight: 1.5,
    enabled: true
  },
  {
    name: 'Chrome for Developers',
    key: 'https://developer.chrome.com/static/blog/feed.xml',
    categoryDefault: 'FE',
    locale: 'en',
    tags: ['global', 'official'],
    weight: 1.3
  },
  {
    name: 'Kubernetes Blog',
    key: 'https://kubernetes.io/feed.xml',
    categoryDefault: 'DEVOPS',
    locale: 'en',
    tags: ['global', 'official'],
    weight: 1.3
  }
];

const defaultPresetName = 'Korea Core (20)';
const defaultPresetSourceKeys = new Set(koreaSources.map((source) => source.key));

async function upsertPreset(name: string, description: string | null, isDefault: boolean) {
  const existing = await prisma.preset.findFirst({ where: { name } });

  if (existing) {
    return prisma.preset.update({
      where: { id: existing.id },
      data: { description, isDefault }
    });
  }

  return prisma.preset.create({
    data: {
      name,
      description,
      isDefault
    }
  });
}

async function main() {
  const allSources = [...koreaSources, ...globalSources];

  for (const source of allSources) {
    const enabled = source.enabled ?? defaultPresetSourceKeys.has(source.key);
    await prisma.source.upsert({
      where: { key: source.key },
      update: {
        name: source.name,
        categoryDefault: source.categoryDefault,
        weight: source.weight ?? 1.0,
        locale: source.locale,
        enabled,
        tags: source.tags,
        type: 'rss'
      },
      create: {
        name: source.name,
        key: source.key,
        categoryDefault: source.categoryDefault,
        weight: source.weight ?? 1.0,
        locale: source.locale,
        enabled,
        tags: source.tags,
        type: 'rss'
      }
    });
  }

  await prisma.preset.updateMany({
    data: { isDefault: false },
    where: { isDefault: true }
  });

  const koreaPreset = await upsertPreset(defaultPresetName, '국내 핵심 기술 블로그 모음', true);
  const globalPreset = await upsertPreset('Global Core', '해외 주요 공식 블로그', false);
  const allPreset = await upsertPreset('All Sources (manual)', '전체 소스 수동 선택용', false);

  const koreaSourceIds = await prisma.source.findMany({
    where: { key: { in: Array.from(defaultPresetSourceKeys) } },
    select: { id: true }
  });

  const globalSourceIds = await prisma.source.findMany({
    where: { key: { in: globalSources.map((source) => source.key) } },
    select: { id: true }
  });

  await prisma.presetSource.createMany({
    data: koreaSourceIds.map((source) => ({
      presetId: koreaPreset.id,
      sourceId: source.id
    })),
    skipDuplicates: true
  });

  await prisma.presetSource.createMany({
    data: globalSourceIds.map((source) => ({
      presetId: globalPreset.id,
      sourceId: source.id
    })),
    skipDuplicates: true
  });

  await prisma.presetSource.createMany({
    data: [...koreaSourceIds, ...globalSourceIds].map((source) => ({
      presetId: allPreset.id,
      sourceId: source.id
    })),
    skipDuplicates: true
  });

  await prisma.rule.createMany({
    data: [
      {
        type: 'keyword',
        pattern: 'CVE',
        action: 'boost',
        weight: 2.0,
        enabled: true
      },
      {
        type: 'keyword',
        pattern: 'deprecated',
        action: 'boost',
        weight: 1.5,
        enabled: true
      },
      {
        type: 'keyword',
        pattern: '채용|이벤트',
        action: 'mute',
        weight: 999,
        enabled: true
      }
    ],
    skipDuplicates: true
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
