import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Allow test imports like '../../server/src/...' to resolve
      'vscode-languageserver/node': path.resolve(__dirname, 'node_modules/vscode-languageserver/node.js'),
    },
  },
});
