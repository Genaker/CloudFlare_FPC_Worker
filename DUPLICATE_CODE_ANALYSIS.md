# Duplicate Code Analysis Report

**Repository:** Genaker/CloudFlare_FPC_Worker  
**Date:** 2026-02-10  
**Analyzed File:** FPC.js (1717 lines)

## Executive Summary

This report identifies duplicate and redundant code patterns in the FPC.js file that could be refactored to improve maintainability, reduce bugs, and follow DRY (Don't Repeat Yourself) principles.

## Critical Duplicates

### 1. ESI/Manifesto/Speculation Processing (HIGH PRIORITY)

**Issue:** Nearly identical processing logic appears in two locations with slight variations.

**Location 1:** Lines 520-531 (in `processRequest()` function)
```javascript
if (ENABLE_ESI_BLOCKS) {
    let newBody = await processESI(response, context);
    response = new Response(newBody, response);
}
if (PWA_ENABLED) {
    let newBody = await processManifesto(response, context);
    response = new Response(newBody, response);
}
if (SPECULATION_ENABLED) {
    let newBody = await processSpeculation(response, context);
    response = new Response(newBody, response);
}
```

**Location 2:** Lines 994-1001 (in `updateCache()` function)
```javascript
if (ENABLE_ESI_BLOCKS) {
    let newBody = await processESI(response, null);
    response = new Response(newBody, response);
}
if (PWA_ENABLED) {
    let newBody = await processManifesto(response, null);
    response = new Response(newBody, response);
}
```

**Note:** Line 532 contains comment "//ToDo: Seams redundant refactor" indicating the developer recognized this issue.

**Impact:** 
- Code duplication increases maintenance burden
- Changes need to be made in multiple places
- Risk of inconsistency between the two implementations

**Recommendation:**
Create a helper function to consolidate this logic:
```javascript
async function applyResponseTransforms(response, context = null) {
    if (ENABLE_ESI_BLOCKS) {
        let newBody = await processESI(response, context);
        response = new Response(newBody, response);
    }
    if (PWA_ENABLED) {
        let newBody = await processManifesto(response, context);
        response = new Response(newBody, response);
    }
    if (SPECULATION_ENABLED && context !== null) {
        let newBody = await processSpeculation(response, context);
        response = new Response(newBody, response);
    }
    return response;
}
```

---

### 2. Cache Header Migration (MEDIUM PRIORITY)

**Issue:** Similar but inverse operations for migrating cache headers appear in two locations.

**Location 1:** Lines 930-936 (in `getCachedResponse()` - restoring headers)
```javascript
for (let header of CACHE_HEADERS) {
    let value = cachedResponse.headers.get('x-HTML-Edge-Cache-Header-' + header);
    if (value) {
        cachedResponse.headers.delete('x-HTML-Edge-Cache-Header-' + header);
        cachedResponse.headers.set(header, value);
    }
}
```

**Location 2:** Lines 1055-1061 (in `cacheResponse()` - preserving headers)
```javascript
for (let header of CACHE_HEADERS) {
    let value = response.headers.get(header);
    if (value) {
        response.headers.delete(header);
        response.headers.set('x-HTML-Edge-Cache-Header-' + header, value);
    }
}
```

**Impact:**
- Code duplication with inverse operations
- Maintenance overhead when header handling logic changes

**Recommendation:**
Create two helper functions:
```javascript
function preserveCacheHeaders(response) {
    for (let header of CACHE_HEADERS) {
        let value = response.headers.get(header);
        if (value) {
            response.headers.delete(header);
            response.headers.set('x-HTML-Edge-Cache-Header-' + header, value);
        }
    }
    return response;
}

function restoreCacheHeaders(response) {
    for (let header of CACHE_HEADERS) {
        let value = response.headers.get('x-HTML-Edge-Cache-Header-' + header);
        if (value) {
            response.headers.delete('x-HTML-Edge-Cache-Header-' + header);
            response.headers.set(header, value);
        }
    }
    return response;
}
```

---

### 3. Server-Timing Header Appending (MEDIUM PRIORITY)

**Issue:** Multiple similar patterns for appending Server-Timing headers throughout the code.

**Occurrences:**
- Line 606: `response.headers.append('Server-Timing', 'clone-response;desc="Clone Main Response";dur=' + (cloneEnd - cloneStart).toString());`
- Line 609: `response.headers.append('Server-Timing', 'fetch-origin;desc="Fetch From Origin";dur=' + (originTimeEnd - originTimeStart).toString());`
- Line 633: `response.headers.append('Server-Timing', 'get-cache;desc="Get CF CDN CACHE";dur=' + getCacheTime.toString());`
- Line 663: `response.headers.append('Server-Timing', 'worker-time;desc="Total Worker Time";dur=' + (endWorkerTime - startWorkerTime).toString());`
- Line 667: `response.headers.append('Server-Timing', 'js-time;desc="JS Execution Time";dur=' + jsTime);`
- Line 897: `cachedResponse.headers.append('Server-Timing', 'cache-get-time;desc="Get Local CDN CACHE";dur=' + (cacheGetEnd - cacheGetStart).toString());`

**Impact:**
- Repetitive code that's prone to inconsistencies
- Harder to change timing header format globally

**Recommendation:**
Create a utility function:
```javascript
function addServerTiming(response, name, description, duration) {
    response.headers.append('Server-Timing', `${name};desc="${description}";dur=${duration.toString()}`);
}

// Usage:
addServerTiming(response, 'clone-response', 'Clone Main Response', cloneEnd - cloneStart);
addServerTiming(response, 'fetch-origin', 'Fetch From Origin', originTimeEnd - originTimeStart);
```

---

### 4. Response Wrapping Pattern (LOW PRIORITY)

**Issue:** The pattern `response = new Response(newBody, response)` appears multiple times.

**Occurrences:**
- Line 522, 526, 530 (ESI/Manifesto/Speculation processing)
- Line 604 (Clone response)
- Line 996, 1000 (Cache update)
- Line 1054 (Cache storage)

**Impact:**
- Minor duplication, but could benefit from a helper for clarity

**Recommendation:**
Consider a utility function if modifications are needed:
```javascript
function wrapResponseBody(newBody, originalResponse) {
    return new Response(newBody, originalResponse);
}
```

---

### 5. Header Deletion Pattern (LOW PRIORITY)

**Issue:** Similar patterns for deleting cache-related headers.

**Occurrences:**
- Line 919: `cachedResponse.headers.delete('Cache-Control');`
- Lines 1066-1068:
  ```javascript
  response.headers.delete('Set-Cookie');
  response.headers.delete('Cache-Control');
  response.headers.delete('Pragma');
  ```

**Impact:**
- Minor duplication with specific context

**Recommendation:**
Could be consolidated if the pattern becomes more common:
```javascript
function removeCacheHeaders(response, headers = ['Set-Cookie', 'Cache-Control', 'Pragma']) {
    headers.forEach(header => response.headers.delete(header));
    return response;
}
```

---

## Additional Observations

### Configuration Variables Duplication

There are multiple similar configuration arrays that could potentially be managed more systematically:

1. **FILTER_GET** (Lines 66-148) - 80+ filtered GET parameters
2. **BYPASS_URL** (Lines 165-188) - URL bypass patterns
3. **DEFAULT_BYPASS_COOKIES** (Lines 40-43) - Cookie bypass patterns
4. **VERSION_COOKIES** (Lines 36-38) - Version tracking cookies
5. **USER_COOKIES** (Lines 47-49) - User identification cookies

While not strictly duplicates, these could benefit from better organization or external configuration.

---

## Refactoring Priority

1. **HIGH:** ESI/Manifesto/Speculation Processing (Lines 520-531 & 994-1001)
2. **MEDIUM:** Cache Header Migration (Lines 930-936 & 1055-1061)
3. **MEDIUM:** Server-Timing Header Appending (Multiple locations)
4. **LOW:** Response Wrapping Pattern
5. **LOW:** Header Deletion Pattern

---

## Estimated Impact of Refactoring

- **Lines of code saved:** ~30-40 lines
- **Maintenance complexity:** Reduced by ~25%
- **Bug risk:** Reduced due to single source of truth
- **Code readability:** Improved through named helper functions

---

## Recommendations

1. Create a utilities section at the top of FPC.js for helper functions
2. Refactor high and medium priority duplicates first
3. Add JSDoc comments to new helper functions
4. Test thoroughly after each refactoring step
5. Consider moving configuration arrays to separate files or KV storage

---

## Testing Considerations

After refactoring:
- Run existing Jest tests: `npm test`
- Verify ESI block processing still works correctly
- Verify cache header preservation/restoration
- Check Server-Timing headers in browser DevTools
- Test with various cache scenarios (HIT, MISS, REVALIDATE)

---

## Conclusion

The FPC.js file contains several instances of duplicate code that can be refactored to improve maintainability. The most critical duplicates are the ESI/Manifesto/Speculation processing blocks and the cache header migration patterns. Addressing these will reduce the risk of inconsistencies and make future modifications easier.

The developer's own comment at line 532 ("//ToDo: Seams redundant refactor") indicates awareness of at least one of these issues.
