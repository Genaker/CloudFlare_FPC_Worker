/**
 * Vitest configuration for FPC.js unit tests.
 *
 * Uses Miniflare as the local Cloudflare Workers runtime — no real network
 * calls are made. Run with:
 *
 *   npm run test:unit
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'fpc-unit',
    environment: 'node',        // Miniflare handles the CF runtime inside each test
    include: ['fpc.unit.test.js'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',              // isolate each test file in a subprocess
    poolOptions: {
      forks: { singleFork: true },  // serial — avoids port conflicts in Miniflare
    },
    reporter: 'verbose',
  },
});
