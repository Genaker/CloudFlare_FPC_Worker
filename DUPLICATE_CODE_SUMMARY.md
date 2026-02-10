# Duplicate Code Summary - Quick Reference

## 🔴 Critical Duplicates (Must Fix)

### 1. Response Transform Processing (Lines 520-531 ↔ 994-1001)
**Pattern:** ESI/Manifesto/Speculation processing  
**Duplication Size:** ~12 lines  
**Locations:**
- `processRequest()` function: Lines 520-531
- `updateCache()` function: Lines 994-1001

**Code:**
```javascript
// Location 1: Lines 520-531
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

// Location 2: Lines 994-1001 (missing SPECULATION_ENABLED)
if (ENABLE_ESI_BLOCKS) {
    let newBody = await processESI(response, null);
    response = new Response(newBody, response);
}
if (PWA_ENABLED) {
    let newBody = await processManifesto(response, null);
    response = new Response(newBody, response);
}
```

**Developer Note:** Line 532 has comment: "//ToDo: Seams redundant refactor"

---

## 🟡 Medium Priority Duplicates

### 2. Cache Header Migration (Lines 930-936 ↔ 1055-1061)
**Pattern:** Header preservation/restoration  
**Duplication Size:** ~7 lines each  
**Locations:**
- `getCachedResponse()` - Restore headers: Lines 930-936
- `cacheResponse()` - Preserve headers: Lines 1055-1061

**Code:**
```javascript
// Location 1: Lines 930-936 (RESTORE from cache)
for (let header of CACHE_HEADERS) {
    let value = cachedResponse.headers.get('x-HTML-Edge-Cache-Header-' + header);
    if (value) {
        cachedResponse.headers.delete('x-HTML-Edge-Cache-Header-' + header);
        cachedResponse.headers.set(header, value);
    }
}

// Location 2: Lines 1055-1061 (PRESERVE to cache)
for (let header of CACHE_HEADERS) {
    let value = response.headers.get(header);
    if (value) {
        response.headers.delete(header);
        response.headers.set('x-HTML-Edge-Cache-Header-' + header, value);
    }
}
```

### 3. Server-Timing Headers (Multiple Locations)
**Pattern:** Performance timing headers  
**Duplication Size:** 1 line each, 6+ occurrences  
**Locations:**
- Line 606: Clone response timing
- Line 609: Fetch origin timing
- Line 633: Get cache timing
- Line 663: Worker time timing
- Line 667: JS execution timing
- Line 897: Cache get timing

**Code:**
```javascript
response.headers.append('Server-Timing', 'name;desc="Description";dur=' + duration.toString());
```

---

## 🟢 Low Priority Duplicates

### 4. Response Wrapping
**Pattern:** `new Response(body, response)`  
**Locations:** Lines 522, 526, 530, 604, 895, 996, 1000, 1054, 1614

### 5. Header Deletion
**Pattern:** Deleting cache control headers  
**Locations:** Lines 919, 1066-1068

---

## Statistics

- **Total Duplicate Blocks:** 5 major patterns
- **Estimated Duplicate Lines:** 35-45 lines
- **File Size:** 1,717 lines
- **Duplication Percentage:** ~2.5%

---

## Quick Refactoring Checklist

- [ ] Extract `applyResponseTransforms()` helper function
- [ ] Create `preserveCacheHeaders()` and `restoreCacheHeaders()` helpers
- [ ] Create `addServerTiming()` utility function
- [ ] Consider `wrapResponseBody()` helper
- [ ] Consider `removeCacheHeaders()` helper
- [ ] Update tests after each refactoring
- [ ] Verify no regressions with integration tests

---

## References

- Detailed analysis: [DUPLICATE_CODE_ANALYSIS.md](./DUPLICATE_CODE_ANALYSIS.md)
- Main source file: [FPC.js](./FPC.js)
- Test file: [fpc.test.js](./fpc.test.js)
