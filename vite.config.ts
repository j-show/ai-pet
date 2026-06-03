import vue from '@vitejs/plugin-vue';
import { type IncomingMessage, type ServerResponse } from 'http';
import { defineConfig, type Plugin } from 'vite';

import {
  DEV_HMR_PORT,
  DEV_PROTOCOL_PATH,
  DEV_SERVER_PORT,
  DEV_SERVER_URL
} from './src/constants/dev-server';
import { AIPET_SCHEME } from './src/constants/protocol';

const host = process.env.TAURI_DEV_HOST;

const aipetDevProtocolPlugin = (): Plugin => {
  return {
    name: 'aipet-dev-protocol',
    configureServer(server) {
      server.middlewares.use(
        DEV_PROTOCOL_PATH,
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST' && req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          let protocolUrl = '';
          if (req.method === 'GET') {
            const requestUrl = new URL(req.url ?? '', DEV_SERVER_URL);
            protocolUrl = requestUrl.searchParams.get('url') ?? '';
          } else {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const raw = Buffer.concat(chunks).toString('utf8').trim();
            if (raw.startsWith('{')) {
              try {
                const body = JSON.parse(raw) as { url?: string };
                protocolUrl = body.url ?? '';
              } catch {
                protocolUrl = '';
              }
            } else {
              protocolUrl = raw;
            }
          }

          if (!protocolUrl?.startsWith(AIPET_SCHEME)) {
            res.statusCode = 400;
            res.end('Missing or invalid url query parameter');
            return;
          }

          server.ws.send({
            type: 'custom',
            event: 'aipet-protocol',
            data: { url: protocolUrl }
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('ok');
        }
      );
    }
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), aipetDevProtocolPlugin()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: DEV_HMR_PORT
        }
      : void 0,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**']
    }
  }
});
