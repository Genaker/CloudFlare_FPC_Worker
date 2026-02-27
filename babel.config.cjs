/**
 * Babel configuration for jest.
 *
 * Transpiles test files (which use require/CommonJS) so they can run
 * under a package with "type": "module".
 * Only active during jest runs — generate.js and FPC.js are unaffected.
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
        modules: 'commonjs', // output CJS so require() works
      },
    ],
  ],
};
