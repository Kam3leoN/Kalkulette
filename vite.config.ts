import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const licencePath = fileURLToPath(new URL('./LICENSE.md', import.meta.url));

/** Sert LICENSE.md en développement et le copie dans dist/ au build (lien de la fenêtre de licence). */
function licence(): Plugin {
  return {
    name: 'kalkulette-licence',
    configureServer(server) {
      server.middlewares.use('/LICENSE.md', (_req, res) => {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.end(readFileSync(licencePath, 'utf8'));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'LICENSE.md', source: readFileSync(licencePath, 'utf8') });
    },
  };
}

export default defineConfig({
  plugins: [licence()],
  build: {
    target: 'es2022',
    /* le paquet K3ui pèse ~1 Mo minifié : on l'isole dans son propre fichier */
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        /* les options K3ui voyagent avec le paquet pour être lues avant son initialisation */
        manualChunks: (id) => (id.includes('/src/vendor/k3ui/') || id.endsWith('/src/k3ui-config.ts') ? 'k3ui' : undefined),
      },
    },
  },
});
