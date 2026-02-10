module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/*.test.js'
  ],
  
  // Coverage collection
  collectCoverageFrom: [
    'FPC.js',
    '!**/node_modules/**',
    '!generate.js'
  ],
  
  // Coverage thresholds (optional - uncomment to enforce)
  // coverageThreshold: {
  //   global: {
  //     branches: 70,
  //     functions: 70,
  //     lines: 70,
  //     statements: 70
  //   }
  // },
  
  // Verbose output
  verbose: false,
  
  // Test timeout (increase for integration tests)
  testTimeout: 60000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset mocks between tests
  resetMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Display individual test results
  displayName: {
    name: 'CloudFlare FPC Worker Tests',
    color: 'blue'
  }
};
