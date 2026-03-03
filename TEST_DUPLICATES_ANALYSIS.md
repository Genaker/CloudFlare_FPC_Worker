# Test File Duplicate Code Analysis

**File:** fpc.test.js (630 lines)

## Identified Duplicate Patterns

### 1. Repeated Test Setup Pattern (19+ occurrences)

**Pattern:**
```javascript
const url = URL + uniqueParam;
const response = await fetch(url);
const headers = response.headers;
console.log(url);
console.log(response);
console.log(headers);
```

**Occurrences:** Lines 28-32, 48-56, 66-73, 83-92, 104-111, 121-130, 143-151, and many more

**Recommendation:**
Create a helper function:
```javascript
async function fetchAndLog(url, options = {}) {
    const response = await fetch(url, options);
    const headers = response.headers;
    console.log(url);
    console.log(response);
    console.log(headers);
    return { response, headers };
}
```

### 2. Common Assertion Patterns (27+ occurrences)

**Pattern:**
```javascript
expect(response.status).toEqual(200);
expect(headers.get('cf-cache-status')).toEqual(HIT);
expect(headers.get('x-html-edge-cache-status')).toContain("Hit");
```

**Recommendation:**
Create assertion helper functions:
```javascript
function expectCacheHit(headers, expectedStatus = HIT) {
    expect(headers.get('cf-cache-status')).toEqual(expectedStatus);
    expect(headers.get('x-html-edge-cache-status')).toContain("Hit");
}

function expectCacheStatus(response, headers, status, cacheStatus) {
    expect(response.status).toEqual(status);
    expect(headers.get('cf-cache-status')).toEqual(cacheStatus);
}
```

### 3. Duplicate Test Blocks

**Test "Repeated Requests Pass CDN" appears TWICE:**
- Lines 83-102
- Lines 121-140

These are identical tests that should be consolidated.

### 4. Common Delay Pattern (12+ occurrences)

**Pattern:**
```javascript
await new Promise((r) => setTimeout(r, XXXX));
```

**Occurrences:** Lines 50, 68, 87, 106, etc.

**Recommendation:**
Create a helper function:
```javascript
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Usage:
await delay(1000);
```

## Statistics

- **Total Patterns:** 4 major duplicate patterns
- **Estimated Duplicate Lines:** 50-70 lines  
- **File Size:** 630 lines
- **Duplication Percentage:** ~10%

## Recommendations

1. Create test helper utilities file (e.g., `test-helpers.js`)
2. Extract common fetch/log operations
3. Extract common assertion patterns
4. Remove duplicate test block (lines 121-140)
5. Use delay helper for all timeouts

## Impact of Refactoring

- **Lines of code saved:** ~50 lines
- **Test readability:** Significantly improved
- **Maintenance:** Much easier to update common patterns
- **Consistency:** Ensures all tests follow same patterns
