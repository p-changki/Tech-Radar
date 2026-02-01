import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastify from 'fastify';
import { ZodError } from 'zod';
import type { FastifyInstance } from 'fastify';
import { registerFetchRoutes } from './routes/fetch.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMaintenanceRoutes } from './routes/maintenance.js';
import { registerPostRoutes } from './routes/posts.js';
import { registerPresetRoutes } from './routes/presets.js';
import { registerRuleRoutes } from './routes/rules.js';
import { registerSourceRoutes } from './routes/sources.js';

export const createServer = async () => {
  const app: FastifyInstance = fastify({ logger: true });

  await app.register(cors, {
    origin: ['http://localhost:3002'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
  });
  await app.register(multipart);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'ValidationError',
        issues: error.issues
      });
    }

    const err = error instanceof Error ? error : new Error('Unknown error');
    const prismaCode = (error as { code?: string }).code;
    if (prismaCode === 'P2002') {
      return reply.status(409).send({
        error: 'UniqueConstraintError',
        message: err.message
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      error: 'ServerError',
      message: err.message
    });
  });

  registerHealthRoutes(app);
  registerMaintenanceRoutes(app);
  registerFetchRoutes(app);
  registerPostRoutes(app);
  registerRuleRoutes(app);
  registerSourceRoutes(app);
  registerPresetRoutes(app);

  return app;
};
