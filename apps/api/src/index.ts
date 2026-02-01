import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { createServer } from './server.js';

const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
loadEnv({ path: envPath });

const port = Number(process.env.API_PORT ?? 4002);

const app = await createServer();

app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
