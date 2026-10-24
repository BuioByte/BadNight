// In sviluppo (e con `vite preview`) la pagina gira su Vite e il WebSocket /ws va in proxy all'engine.
// Dopo la build la pagina la serve l'engine stesso, sullo stesso host e porta del WebSocket.

import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy = { '/ws': { target: env.ENGINE_URL || 'http://127.0.0.1:3000', ws: true } };
  return {
    server: { proxy },
    preview: { proxy },
  };
});
