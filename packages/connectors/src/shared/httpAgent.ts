import { Agent } from 'undici';

export const httpAgent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 60_000,
  connections: 128
});
