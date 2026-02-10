# Test Examples and Usage Guide

This guide provides practical examples of how to use and extend the test suite.

## Running Tests - Quick Start

```bash
# Install dependencies first
npm install

# Run only unit and mock tests (fastest, no external dependencies)
npm run test:unit

# Run integration tests (requires TEST_URL)
export TEST_URL="https://your-site.com/"
npm run test:integration

# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

## Example Test Scenarios

### 1. Testing URL Normalization

The worker filters marketing parameters like UTM codes and Facebook click IDs:

```javascript
// Input URL
https://example.com/product?id=123&utm_source=facebook&fbclid=xyz

// After normalization (marketing params removed, sorted alphabetically)
https://example.com/product?id=123
```

**Test:**
```javascript
test('should remove marketing parameters', () => {
    const url = 'https://example.com/product?id=123&utm_source=facebook';
    const normalized = normalizeUrl(url, ['utm_source', 'fbclid']);
    expect(normalized.toString()).toBe('https://example.com/product?id=123');
});
```

### 2. Testing Cache Versioning

The worker uses version numbers to invalidate entire cache:

```javascript
// Version 1
https://example.com/page?cf_edge_cache_ver=1

// After purge (version 2 - all v1 URLs become stale)
https://example.com/page?cf_edge_cache_ver=2
```

**Test:**
```javascript
test('should increment cache version', async () => {
    await mockKV.put('html_cache_version', '1');
    
    const current = parseInt(await mockKV.get('html_cache_version'));
    const newVersion = current + 1;
    await mockKV.put('html_cache_version', String(newVersion));
    
    expect(await mockKV.get('html_cache_version')).toBe('2');
});
```

### 3. Testing Cookie Bypass

Users with admin cookies should bypass cache:

```javascript
// Cookie header
Cookie: admin=token123; session=abc

// Result: Bypass cache = true
```

**Test:**
```javascript
test('should bypass cache with admin cookie', () => {
    const cookieHeader = 'admin=token123; session=abc';
    const bypassCookies = ['admin'];
    expect(checkCookies(cookieHeader, bypassCookies)).toBe(true);
});
```

### 4. Testing Stale-While-Revalidate

Content with age > TTL should be served while revalidating:

```javascript
// Cached page: age = 3700 seconds, TTL = 3600 seconds
// Result: Serve stale, revalidate in background
```

**Test:**
```javascript
test('should serve stale content within revalidation window', () => {
    const age = 3700;  // seconds
    const ttl = 3600;  // seconds
    const staleWindow = 300;  // 5 minutes
    
    expect(shouldRevalidate(age, ttl, staleWindow)).toBe(true);
});
```

### 5. Testing Device Detection

Separate cache for mobile and desktop:

```javascript
// Mobile user agent
Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)
// Cache key includes: &device=mobile

// Desktop user agent
Mozilla/5.0 (Windows NT 10.0; Win64; x64)
// Cache key includes: &device=desktop
```

**Test:**
```javascript
test('should detect mobile devices', () => {
    const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)';
    expect(detectDevice(userAgent)).toBe('mobile');
});
```

## Integration Test Examples

### Testing Cache Hit/Miss

```bash
# Set your test URL
export TEST_URL="https://your-site.com/"

# Run integration tests
npm run test:integration
```

**What happens:**
1. First request to unique URL → Cache MISS → Fetches from origin
2. Second request to same URL → Cache HIT → Serves from CloudFlare
3. Third request verifies cache headers (Age, CF-Cache-Status)

### Testing Cache Purge

```bash
# Request with purge parameter
https://your-site.com/?cf-purge=true

# Result:
# - Cache version incremented: v1 → v2
# - All v1 cached pages become stale
# - Next request fetches fresh content with v2
```

## Common Test Patterns

### Pattern 1: Arrange-Act-Assert

```javascript
test('should store and retrieve from cache', async () => {
    // Arrange
    const mockCache = new MockCache();
    const request = new MockRequest('https://example.com/page');
    const response = new MockResponse('Hello World');

    // Act
    await mockCache.put(request, response);
    const cached = await mockCache.match(request);
    
    // Assert
    expect(cached).not.toBeNull();
    expect(cached.body).toBe('Hello World');
});
```

### Pattern 2: Testing Edge Cases

```javascript
test('should handle empty cookie string', () => {
    expect(getCookie('', 'name')).toBeNull();
});

test('should handle null input', () => {
    expect(parseBoolean(null)).toBe(false);
});

test('should handle URL with no query parameters', () => {
    const url = 'https://example.com/page';
    const normalized = normalizeUrl(url, []);
    expect(normalized.toString()).toBe('https://example.com/page');
});
```

### Pattern 3: Testing Multiple Scenarios

```javascript
describe('Status Code Validation', () => {
    test('should cache 200 responses', () => {
        expect(isValidCacheStatus(200)).toBe(true);
    });

    test('should cache 301 redirects', () => {
        expect(isValidCacheStatus(301)).toBe(true);
    });

    test('should not cache 404 errors', () => {
        expect(isValidCacheStatus(404)).toBe(false);
    });

    test('should not cache 500 errors', () => {
        expect(isValidCacheStatus(500)).toBe(false);
    });
});
```

## Adding Your Own Tests

### Step 1: Identify What to Test

Example: You add a new feature to filter sensitive headers

### Step 2: Write the Test

```javascript
describe('Sensitive Header Filtering', () => {
    function filterSensitiveHeaders(headers, sensitiveList) {
        const filtered = new Map(headers);
        sensitiveList.forEach(header => {
            filtered.delete(header.toLowerCase());
        });
        return filtered;
    }

    test('should remove authorization header', () => {
        const headers = new Map([
            ['authorization', 'Bearer token'],
            ['content-type', 'text/html']
        ]);
        const sensitive = ['authorization'];
        
        const filtered = filterSensitiveHeaders(headers, sensitive);
        
        expect(filtered.has('authorization')).toBe(false);
        expect(filtered.has('content-type')).toBe(true);
    });

    test('should handle case insensitive matching', () => {
        const headers = new Map([['Authorization', 'Bearer token']]);
        const filtered = filterSensitiveHeaders(headers, ['authorization']);
        expect(filtered.has('authorization')).toBe(false);
    });
});
```

### Step 3: Run Your Tests

```bash
npm run test:unit
```

## Debugging Tests

### Enable Verbose Output

```bash
npm test -- --verbose
```

### Run Single Test File

```bash
npm test -- fpc.unit.test.js
```

### Run Single Test Case

```bash
npm test -- -t "should remove marketing parameters"
```

### Watch Mode (Re-run on file changes)

```bash
npm test -- --watch
```

## Best Practices

### ✅ DO:
- Write descriptive test names
- Test edge cases (null, empty, invalid input)
- Keep tests independent (no shared state)
- Use beforeEach/afterEach for setup/cleanup
- Test one thing per test case
- Use meaningful variable names

### ❌ DON'T:
- Don't test implementation details
- Don't write tests that depend on other tests
- Don't use real network requests in unit tests
- Don't skip test failures
- Don't write overly complex tests

## Performance Tips

### Fast Tests
```bash
# Run only unit/mock tests (< 1 second)
npm run test:unit
```

### Parallel Execution
Jest runs tests in parallel by default. For large test suites:
```bash
npm test -- --maxWorkers=4
```

### Skip Slow Tests During Development
```javascript
test.skip('slow integration test', () => {
    // This test will be skipped
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:coverage
```

### Pre-commit Hook Example

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:unit"
    }
  }
}
```

## Troubleshooting

### Tests are slow
- Check if you're accidentally running integration tests
- Use `npm run test:unit` for fast tests

### Tests fail randomly
- Check for shared state between tests
- Use `beforeEach` to reset state
- Ensure tests are independent

### Coverage is 0%
- This is expected for CloudFlare Workers
- See TESTING.md for explanation
- Focus on test count and quality, not coverage percentage

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [CloudFlare Workers Testing](https://developers.cloudflare.com/workers/testing/)

## Next Steps

1. Run `npm run test:unit` to verify all tests pass
2. Review the test files to understand patterns
3. Add tests for any new features you develop
4. Set up CI/CD to run tests automatically
5. Consider adding performance benchmarks
