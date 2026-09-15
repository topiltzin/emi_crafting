import path from 'node:path';

// Test-only stand-in for Vite's `sql.js/dist/sql-wasm.wasm?url` asset import (see vite.config.js
// alias). Exports the real on-disk path as a plain string, matching what sql-wasm.js's Node
// fs.readFileSync fallback expects when there is no dev server to serve a URL from.
export default path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
