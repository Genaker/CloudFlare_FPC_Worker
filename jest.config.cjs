/**
 * Jest configuration for CloudFlare FPC Worker tests.
 *
 * package.json has "type": "module" (needed by generate.js which uses ESM import).
 * The test file fpc.test.js uses require() (CommonJS).
 * babel-jest bridges the gap by transpiling test files to CommonJS at run time.
 *
 * This file uses .cjs extension so Node loads it as CommonJS regardless of "type": "module".
 */
module.exports = {
  testEnvironment: 'node',

  // Transform .js test files from CJS syntax → actual CJS modules
  transform: {
    '^.+\\.js$': 'babel-jest',
  },

  // Only run integration tests (fpc.test.js). Unit tests use vitest: npm run test:unit
  testMatch: ['**/fpc.test.js'],

  // Show each test name while running
  verbose: true,

  // One suite at a time keeps timing-sensitive cache tests reliable
  maxWorkers: 1,

  // Generous timeout — integration tests wait for async cache propagation
  testTimeout: 120000,
};
