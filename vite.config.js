import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// sql.js's `?url` import resolves to a dev-server-root-relative path (e.g. "/node_modules/...")
// for the browser build. Under Vitest (Node, no dev server) that same string is misread by
// sql-wasm.js's fs.readFileSync fallback as an absolute OS path, causing ENOENT. This test-only
// alias swaps it for a shim module exporting the real on-disk path, without changing the Vite
// browser build.
const sqlWasmUrlShim = fileURLToPath(new URL('./tests/shims/sql-wasm-url.js', import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // jsdom disables the Storage API (localStorage/sessionStorage) on the default opaque
    // "about:blank" origin. A real http(s) URL gives the test environment a proper origin so
    // localStorage works — needed by src/modules/theme.js's appearance-preference storage.
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/'
      }
    },
    setupFiles: ['./tests/setup.js'],
    alias: {
      'sql.js/dist/sql-wasm.wasm?url': sqlWasmUrlShim
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
        '.eslintrc.cjs',
        'src/main.js'
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    }
  }
});
