import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@tech-radar/db';
import { RuleActionEnum, RuleTypeEnum } from '@tech-radar/shared';

export const registerRuleRoutes = (app: FastifyInstance) => {
  app.post('/v1/rules', async (request) => {
    const ruleSchema = z.object({
      type: RuleTypeEnum,
      pattern: z.string().min(1),
      action: RuleActionEnum,
      weight: z.number().min(0.1).max(100).default(1),
      enabled: z.boolean().default(true)
    });

    const data = ruleSchema.parse(request.body);
    const rule = await prisma.rule.create({ data });
    return { rule };
  });

  app.get('/v1/rules', async () => {
    const rules = await prisma.rule.findMany({ orderBy: { id: 'desc' } });
    return { rules };
  });
};
