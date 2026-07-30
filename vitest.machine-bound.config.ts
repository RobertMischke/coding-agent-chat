import { defineConfig } from 'vitest/config';

/**
 * Opt-in, capture-backed parity suite. Kept separate from the default Vitest
 * include/exclude path to match the runner's MachineBound fixture convention.
 */
export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    fileParallelism: false,
    maxWorkers: 1,
    include: ['projects/coding-agent-chat/core/test-fixtures/**/*.machine-bound.ts'],
    exclude: ['**/node_modules/**'],
  },
});
