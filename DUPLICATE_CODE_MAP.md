# Duplicate Code Location Map

## FPC.js File Structure (1717 lines)

```
┌────────────────────────────────────────────────────────────────┐
│ FPC.js - CloudFlare Worker Full Page Cache                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Lines 1-300: Configuration & Global Variables                │
│  ├─ 36-38:   VERSION_COOKIES config                          │
│  ├─ 40-43:   DEFAULT_BYPASS_COOKIES config                   │
│  ├─ 47-49:   USER_COOKIES config                             │
│  ├─ 66-148:  FILTER_GET parameters (80+ items)               │
│  └─ 165-188: BYPASS_URL patterns                             │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Lines 300-600: Request Processing                            │
│  ├─ 310:      Response creation pattern                      │
│  ├─ 319:      Response creation pattern                      │
│  ├─ 450-478:  Multiple Response creation patterns            │
│  │                                                             │
│  ⚠️ DUPLICATE #1: Lines 520-531 ⚠️                           │
│  │   ESI/Manifesto/Speculation Processing                    │
│  │   ┌─────────────────────────────────────────┐            │
│  │   │ if (ENABLE_ESI_BLOCKS) { ... }         │            │
│  │   │ if (PWA_ENABLED) { ... }               │            │
│  │   │ if (SPECULATION_ENABLED) { ... }       │            │
│  │   │ //ToDo: Seams redundant refactor       │            │
│  │   └─────────────────────────────────────────┘            │
│  │                                                             │
│  └─ 604:      Response wrapping pattern                      │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Lines 600-900: Cache Management                              │
│  ├─ 606:      Server-Timing header append ⚠️                 │
│  ├─ 609:      Server-Timing header append ⚠️                 │
│  ├─ 633:      Server-Timing header append ⚠️                 │
│  ├─ 663:      Server-Timing header append ⚠️                 │
│  ├─ 667:      Server-Timing header append ⚠️                 │
│  │                                                             │
│  ├─ 857:      Response creation pattern                      │
│  ├─ 895:      Response wrapping pattern                      │
│  └─ 897:      Server-Timing header append ⚠️                 │
│                                                                │
│  ⚠️ DUPLICATE #2: Lines 930-936 ⚠️                           │
│  │   Cache Header Restoration                                │
│  │   ┌─────────────────────────────────────────┐            │
│  │   │ for (let header of CACHE_HEADERS) {    │            │
│  │   │   // Restore from x-HTML-Edge-Cache-   │            │
│  │   │   // Header-* format                   │            │
│  │   │ }                                       │            │
│  │   └─────────────────────────────────────────┘            │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Lines 900-1100: Cache Update & Storage                       │
│  │                                                             │
│  ⚠️ DUPLICATE #1b: Lines 994-1001 ⚠️                         │
│  │   ESI/Manifesto Processing (AGAIN!)                       │
│  │   ┌─────────────────────────────────────────┐            │
│  │   │ if (ENABLE_ESI_BLOCKS) { ... }         │            │
│  │   │ if (PWA_ENABLED) { ... }               │            │
│  │   │ // Missing SPECULATION_ENABLED         │            │
│  │   └─────────────────────────────────────────┘            │
│  │                                                             │
│  ├─ 996:      Response wrapping pattern                      │
│  ├─ 1000:     Response wrapping pattern                      │
│  │                                                             │
│  ⚠️ DUPLICATE #2b: Lines 1055-1061 ⚠️                        │
│  │   Cache Header Preservation                               │
│  │   ┌─────────────────────────────────────────┐            │
│  │   │ for (let header of CACHE_HEADERS) {    │            │
│  │   │   // Convert to x-HTML-Edge-Cache-     │            │
│  │   │   // Header-* format                   │            │
│  │   │ }                                       │            │
│  │   └─────────────────────────────────────────┘            │
│  │                                                             │
│  └─ 1054:     Response wrapping pattern                      │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Lines 1100-1400: Helper Functions                            │
│  ├─ 1326:     processESI() function definition               │
│  ├─ 1371:     processManifesto() function definition         │
│  └─ 1388:     processSpeculation() function definition       │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Lines 1400-1717: Additional Utilities                        │
│  └─ 1614:     Response wrapping pattern                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘

Legend:
  ⚠️  = Duplicate code requiring refactoring
  ├─ = Code location
  └─ = Code location (last in section)
```

## Duplication Summary

| # | Pattern | Locations | Priority | Lines | Saved |
|---|---------|-----------|----------|-------|-------|
| 1 | ESI/Manifesto/Speculation | 520-531, 994-1001 | 🔴 HIGH | ~12 | ~10 |
| 2 | Cache Header Migration | 930-936, 1055-1061 | 🟡 MED | ~7 | ~5 |
| 3 | Server-Timing Headers | 606,609,633,663,667,897 | 🟡 MED | 6 | ~4 |
| 4 | Response Wrapping | 522,526,530,604,895,996,1000,1054,1614 | 🟢 LOW | 9 | ~2 |
| 5 | Header Deletion | 919,1066-1068 | 🟢 LOW | 4 | ~2 |

**Total Potential Savings:** ~25-30 lines of code

## Visualization of Duplicate #1 (Most Critical)

```
┌─────────────────────────────────────────────────────────────┐
│                     DUPLICATE BLOCK #1                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📍 Location 1: Lines 520-531                               │
│  Function: processRequest()                                 │
│  Context: After fetching from origin                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │ if (ENABLE_ESI_BLOCKS) {                           │    │
│  │     let newBody = await processESI(response, ctx); │    │
│  │     response = new Response(newBody, response);    │    │
│  │ }                                                  │    │
│  │ if (PWA_ENABLED) {                                 │    │
│  │     let newBody = await processManifesto(res, ctx);│    │
│  │     response = new Response(newBody, response);    │    │
│  │ }                                                  │    │
│  │ if (SPECULATION_ENABLED) {                         │    │
│  │     let newBody = await processSpeculation(r, ctx);│    │
│  │     response = new Response(newBody, response);    │    │
│  │ }                                                  │    │
│  └────────────────────────────────────────────────────┘    │
│  Comment on line 532: "//ToDo: Seams redundant refactor"   │
│                                                              │
│                         ⬇️  ⬇️  ⬇️                          │
│                      (DUPLICATED)                           │
│                         ⬇️  ⬇️  ⬇️                          │
│                                                              │
│  📍 Location 2: Lines 994-1001                              │
│  Function: updateCache()                                    │
│  Context: Before caching response                           │
│  ┌────────────────────────────────────────────────────┐    │
│  │ if (ENABLE_ESI_BLOCKS) {                           │    │
│  │     let newBody = await processESI(response, null);│    │
│  │     response = new Response(newBody, response);    │    │
│  │ }                                                  │    │
│  │ if (PWA_ENABLED) {                                 │    │
│  │     let newBody = await processManifesto(res, null);│   │
│  │     response = new Response(newBody, response);    │    │
│  │ }                                                  │    │
│  │ // ❌ Missing SPECULATION_ENABLED check            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ⚠️  Issues:                                                │
│  • Code duplication (11 lines)                             │
│  • Inconsistent: Location 2 missing SPECULATION_ENABLED    │
│  • Different context parameter (context vs null)           │
│  • Maintenance burden: changes must be made twice          │
│                                                              │
│  ✅ Recommended Solution:                                   │
│  Create: async function applyResponseTransforms(...)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Files Created

1. **DUPLICATE_CODE_ANALYSIS.md** - Detailed analysis with recommendations
2. **DUPLICATE_CODE_SUMMARY.md** - Quick reference guide
3. **TEST_DUPLICATES_ANALYSIS.md** - Test file duplicate analysis
4. **DUPLICATE_CODE_MAP.md** - This visual map

## Next Steps

1. Review this analysis with the team
2. Prioritize refactoring efforts (start with 🔴 HIGH priority)
3. Create helper functions
4. Update tests after each refactoring
5. Document the new helper functions with JSDoc
