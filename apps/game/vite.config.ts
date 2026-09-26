import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // During `npm run dev`, API calls go to the Fastify server (`npm run dev:server`).
    proxy: { '/api': 'http://localhost:3000' },
  },
});
