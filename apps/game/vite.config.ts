import { defineConfig, type Plugin } from 'vite';
import { compileInkFile } from './tools/ink.ts';

/** Lets the client `import storyJson from '.../main.ink'`; INCLUDEd files trigger HMR too. */
function ink(): Plugin {
  return {
    name: 'eferon-ink',
    load(id) {
      if (!id.endsWith('.ink')) return null;
      const { json, warnings } = compileInkFile(id);
      for (const w of warnings) this.warn(w);
      return `export default ${JSON.stringify(json)};`;
    },
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.ink')) return;
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

export default defineConfig({
  plugins: [ink()],
  // three + inkjs are one ~700 kB chunk; fine for a desktop game.
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    // During `npm run dev`, API calls go to the Fastify server (`npm run dev:server`).
    proxy: { '/api': 'http://localhost:3000' },
  },
});
