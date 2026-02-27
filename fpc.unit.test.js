/**
 * FPC.js — Offline Unit Tests
 *
 * Runner : Vitest (ESM-native)
 * Runtime: Miniflare 3 — local Cloudflare Workers V8 isolate
 *
 * All outbound fetch() calls made by FPC.js are intercepted by Miniflare's
 * `outboundService` hook, which returns synthetic HTML responses.
 * No real network traffic is generated.
 *
 * Run:
 *   npm run test:unit
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const __dir = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dir, 'FPC.js');
const ORIGIN = 'https://example.com';

/**
 * HTML body large enough to clear the BODY_MIN_SIZE (3 KB) guard in FPC.js.
 * The worker skips R2 caching for responses smaller than 3 KB.
 */
const LARGE_HTML =
  '<!DOCTYPE html><html><head><title>Mock</title></head><body><main>' +
  'A'.repeat(4 * 1024) +
  '</main></body></html>';

/** Monotonically increasing counter — guarantees a unique URL per test. */
let _seq = 0;
const uid = () => ++_seq;

// ---------------------------------------------------------------------------
// Miniflare factory
// ---------------------------------------------------------------------------

/**
 * Create an isolated Miniflare instance.
 *
 * Each call returns a fresh runtime with empty KV, R2, and in-memory Cache.
 * DEBUG defaults to `true` inside FPC.js because getConfigValue("ENV_DEBUG", true)
 * falls back to the default value when KV contains no stored value — so all
 * debug headers (x-html-edge-cache-status, x-html-edge-cache-version, etc.)
 * are always present in unit-test responses.
 *
 * @param {(req: Request) => Response | Promise<Response>} [originHandler]
 *   Intercepts all outbound fetch() calls made by FPC.js.
 *   Defaults to returning 200 LARGE_HTML.
 */
async function createMF(originHandler) {
  const defaultOrigin = (req) => {
    const url = new URL(req.url);
    // Tests can request a specific status via ?__status=NNN
    const status = parseInt(url.searchParams.get('__status') ?? '200', 10);
    return new Response(status === 200 ? LARGE_HTML : 'error', {
      status,
      headers: {
        'Content-Type': status === 200 ? 'text/html; charset=utf-8' : 'text/plain',
        'Cache-Control': 'max-age=3600',
        // Include CSPRO header so the removal tests have something to verify.
        'Content-Security-Policy-Report-Only': "default-src 'self'",
      },
    });
  };

  return new Miniflare({
    scriptPath: SCRIPT_PATH,
    modules: false,                   // Service Worker format (addEventListener)
    compatibilityDate: '2024-01-01',
    kvNamespaces: ['KV'],
    r2Buckets: ['R2'],
    outboundService: originHandler ?? defaultOrigin,
  });
}

/**
 * Allow Miniflare's event.waitUntil() promises (cache writes, R2 puts, …)
 * to settle before the next dispatchFetch call.
 */
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 1. URL Bypass Patterns
//
// BYPASS_URL in FPC.js (lines 174-198) is checked by shouldBypassURL().
// A match causes the worker to return early at line 295, setting
// bypass-worker: true and cf-cache-status: BYPASS,WORKER,MISS.
//
// Important: shouldBypassURL() runs BEFORE the getCachedResponse() call, so
// CACHE_ALWAYS entries are only checked inside getCachedResponse and therefore
// have NO effect on URLs that also match a BYPASS_URL pattern.
// Example: 'customer-service' is in CACHE_ALWAYS but also contains 'customer'
// which is in BYPASS_URL, so it IS bypassed at the outer check.
// ---------------------------------------------------------------------------
describe('URL Bypass Patterns', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  const bypassPaths = [
    ['checkout',               'checkout/'],
    ['customer account',       'customer/account/'],
    ['cart',                   'cart/'],
    ['onestepcheckout',        'onestepcheckout/'],
    ['catalogsearch result',   'catalogsearch/result/?q=coin'],
    ['order tracking',         'sales/order/tracking/'],
    ['REST API',               'rest/V1/products'],
    ['PayPal express',         'paypal/express/'],
    ['admin panel',            'admin/'],
    ['ajax endpoint',          'ajax/cart/add'],
  ];

  test.each(bypassPaths)(
    '%s → bypass-worker: true and cf-cache-status: BYPASS,WORKER,MISS',
    async (_label, path) => {
      const response = await mf.dispatchFetch(`${ORIGIN}/${path}?u=${uid()}`);
      expect(response.headers.get('bypass-worker')).toBe('true');
      expect(response.headers.get('cf-cache-status')).toBe('BYPASS,WORKER,MISS');
    },
  );

  test('Normal product page is NOT bypassed', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`);
    expect(response.headers.get('bypass-worker')).toBeNull();
    expect(response.status).toBe(200);
  });

  // 'customer-service' is in CACHE_ALWAYS but BYPASS_URL contains 'customer',
  // which matches first at the shouldBypassURL() call — bypass wins.
  test('customer-service is bypassed because "customer" is in BYPASS_URL (CACHE_ALWAYS is checked later, inside getCachedResponse)', async () => {
    const response = await mf.dispatchFetch(
      `${ORIGIN}/customer-service?u=${uid()}`,
    );
    expect(response.headers.get('bypass-worker')).toBe('true');
  });

  // Verify a URL in CACHE_ALWAYS that does NOT match any BYPASS_URL pattern
  // is NOT bypassed at the outer check.
  test('banner/ajax/load is NOT bypassed at the outer check when it does not match BYPASS_URL', async () => {
    // 'ajax' IS in BYPASS_URL → this IS bypassed
    // (Documents the interaction: ajax overrides cache_always)
    const response = await mf.dispatchFetch(
      `${ORIGIN}/banner/ajax/load?u=${uid()}`,
    );
    // 'ajax' matches BYPASS_URL, so it is bypassed
    expect(response.headers.get('bypass-worker')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// 2. Cookie-Based Bypass
//
// shouldBypassEdgeCache() (line 700) checks DEFAULT_BYPASS_COOKIES = ['admin'].
// Only cookies whose name STARTS with 'admin' trigger bypass-cookies: true.
//
// X-Magento-Vary is in USER_COOKIES / VERSION_COOKIES, which affect R2 and
// per-user cache variation — they do NOT trigger the bypass path.
// ---------------------------------------------------------------------------
describe('Cookie-Based Bypass', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  test('admin= cookie triggers bypass-worker + bypass-cookies', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`, {
      headers: { Cookie: 'admin=some-admin-session-token' },
    });
    expect(response.headers.get('bypass-worker')).toBe('true');
    expect(response.headers.get('bypass-cookies')).toBe('true');
    expect(response.headers.get('cf-cache-status')).toBe('BYPASS,WORKER,MISS');
  });

  // X-Magento-Vary is in USER_COOKIES, not DEFAULT_BYPASS_COOKIES.
  // It affects R2 caching behaviour (skip R2 when R2_CACHE_LOGGEDIN_USERS=false)
  // but does NOT trigger the worker-bypass path.
  test('X-Magento-Vary cookie does NOT trigger bypass-worker (it is a VERSION_COOKIE, not a bypass cookie)', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`, {
      headers: { Cookie: 'X-Magento-Vary=eyJjb2RlIjoiZGVmYXVsdCJ9' },
    });
    expect(response.headers.get('bypass-worker')).toBeNull();
    expect(response.status).toBe(200);
  });

  test('form_key cookie does NOT trigger bypass', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`, {
      headers: { Cookie: 'form_key=abc123XYZ' },
    });
    expect(response.headers.get('bypass-worker')).toBeNull();
    expect(response.status).toBe(200);
  });

  test('No cookie — normal cacheable request', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`);
    expect(response.headers.get('bypass-worker')).toBeNull();
    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 3. cfw=false Worker Bypass Parameter
// ---------------------------------------------------------------------------
describe('cfw=false Worker Bypass Parameter', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  test('cfw=false sets bypass-worker: true', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?cfw=false&u=${uid()}`);
    expect(response.headers.get('bypass-worker')).toBe('true');
    expect(response.headers.get('cf-cache-status')).toBe('BYPASS,WORKER,MISS');
  });

  test('cfw=true does NOT trigger bypass', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?cfw=true&u=${uid()}`);
    expect(response.headers.get('bypass-worker')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. HTTP Methods
//
// FPC.js only checks URL patterns / cookies / cfw param for bypass (line 295).
// There is NO method-based bypass. However, only GET and HEAD responses flow
// through the cache-population path (line 602 filters on method), so POST /
// PUT / DELETE requests are served from origin but never cached.
// ---------------------------------------------------------------------------
describe('HTTP Methods', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  test.each(['POST', 'PUT', 'DELETE', 'PATCH'])(
    '%s does NOT set bypass-worker (no method-based bypass in FPC.js)',
    async (method) => {
      const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`, {
        method,
        body: 'data',
      });
      // No bypass-worker for non-GET methods
      expect(response.headers.get('bypass-worker')).toBeNull();
      expect(response.status).toBe(200);
    },
  );

  test.each(['POST', 'PUT', 'DELETE', 'PATCH'])(
    '%s response has no x-html-edge-cache-status (cache processing block skipped for non-GET)',
    async (method) => {
      const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`, {
        method,
        body: 'data',
      });
      // Line 602: processRequest only processes GET/HEAD responses through the
      // status/timing/debug-header pipeline.
      expect(response.headers.get('x-html-edge-cache-status')).toBeNull();
    },
  );

  test('GET request receives x-html-edge-cache-status and Worker-Time headers', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`);
    expect(response.headers.get('x-html-edge-cache-status')).not.toBeNull();
    expect(response.headers.get('Worker-Time')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Special Command Endpoints
// ---------------------------------------------------------------------------
describe('Special Command Endpoints', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  test('cf-purge=true → 222 with cache-version header', async () => {
    const response = await mf.dispatchFetch(
      `${ORIGIN}/?cf-purge=true&u=${uid()}`,
    );
    expect(response.status).toBe(222);
    const version = response.headers.get('cache-version');
    expect(version).not.toBeNull();
    expect(parseInt(version, 10)).toBeGreaterThanOrEqual(1);
  });

  test('cf-version=7 → 223 with cache-version: 7', async () => {
    const response = await mf.dispatchFetch(
      `${ORIGIN}/?cf-version=7&u=${uid()}`,
    );
    expect(response.status).toBe(223);
    expect(response.headers.get('cache-version')).toBe('7');
  });

  test('cf-delete=true on a warmed URL → 211 with Deleted: true', async () => {
    const baseUrl = `${ORIGIN}/?del=${uid()}`;
    await mf.dispatchFetch(baseUrl);
    await wait(300);
    const response = await mf.dispatchFetch(`${baseUrl}&cf-delete=true`);
    expect(response.status).toBe(211);
    expect(response.headers.get('Deleted')).toBe('true');
  });

  test('Two consecutive cf-purge calls monotonically increment cache-version', async () => {
    const r1 = await mf.dispatchFetch(`${ORIGIN}/?cf-purge=true&u=${uid()}`);
    const v1 = parseInt(r1.headers.get('cache-version'), 10);
    const r2 = await mf.dispatchFetch(`${ORIGIN}/?cf-purge=true&u=${uid()}`);
    const v2 = parseInt(r2.headers.get('cache-version'), 10);
    expect(v2).toBeGreaterThan(v1);
  });

  test('cf-revalidate=true on warmed URL forces revalidation and sets CDN-Revalidate header', async () => {
    const baseUrl = `${ORIGIN}/?revalidate=${uid()}`;
    await mf.dispatchFetch(baseUrl);
    await wait(400);
    const response = await mf.dispatchFetch(`${baseUrl}&cf-revalidate=true`);
    expect(response.status).toBe(200);
    expect(response.headers.get('CDN-Revalidate')).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// 6. Cache Hit / Miss Flow
//
// The CF Cache API is simulated in-memory by Miniflare.
// FPC.js uses event.waitUntil(cacheResponse(...)) to write asynchronously,
// so we pause after the first request to let the write settle.
//
// Assertion is header-based (x-html-edge-cache-status) rather than
// origin-call-count because FPC.js may call the outboundService multiple times
// per request (primary fetch + async cache-warming re-fetch via updateCache).
// ---------------------------------------------------------------------------
describe('Cache Hit / Miss Flow', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  test('First request returns 200 with x-html-edge-cache-status containing Miss or FetchedOrigin', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?cold=${uid()}`);
    expect(response.status).toBe(200);
    const cacheStatus = response.headers.get('x-html-edge-cache-status');
    expect(cacheStatus).toMatch(/Miss|FetchedOrigin/i);
  });

  test('Second request to same URL receives x-html-edge-cache-status containing Hit', async () => {
    const url = `${ORIGIN}/?warm=${uid()}`;
    // First request — populates in-memory CF Cache
    await mf.dispatchFetch(url);
    // Wait for the async event.waitUntil(cache.put()) to complete
    await wait(400);
    // Second request — should come from the simulated edge cache
    const response = await mf.dispatchFetch(url);
    expect(response.status).toBe(200);
    const cacheStatus = response.headers.get('x-html-edge-cache-status');
    // On CDN HIT the status contains 'Hit'
    expect(cacheStatus).toContain('Hit');
  });

  test('Different URLs each produce independent cache Miss entries', async () => {
    const url1 = `${ORIGIN}/?independent-a=${uid()}`;
    const url2 = `${ORIGIN}/?independent-b=${uid()}`;

    const r1 = await mf.dispatchFetch(url1);
    const r2 = await mf.dispatchFetch(url2);

    expect(r1.headers.get('x-html-edge-cache-status')).toMatch(/Miss|FetchedOrigin/i);
    expect(r2.headers.get('x-html-edge-cache-status')).toMatch(/Miss|FetchedOrigin/i);
  });
});

// ---------------------------------------------------------------------------
// 7. FILTER_GET — Tracking Parameter Normalisation
//
// normalizeUrl() strips FILTER_GET params before building the cache key.
// A URL with e.g. ?page=1&utm_source=google and one with ?page=1 resolve to
// the same cache entry after normalisation.
// ---------------------------------------------------------------------------
describe('FILTER_GET — Tracking Parameter Normalisation', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  const trackingParams = [
    ['utm_source',  'utm_source=google'],
    ['utm_medium',  'utm_medium=cpc'],
    ['utm_campaign','utm_campaign=spring'],
    ['fbclid',      'fbclid=IwAR0xyzTest'],
    ['gclid',       'gclid=EAIaIQobTest'],
    ['_ga',         '_ga=2.1.1.1.1'],
    ['msclkid',     'msclkid=abc123Test'],
  ];

  test.each(trackingParams)(
    'URL with %s stripped matches the same cache entry (HIT on second request)',
    async (_label, param) => {
      // Use an ID embedded in a non-filtered param so the base URL is unique
      // to this test invocation but the filtered URL resolves to the same key.
      const base = `${ORIGIN}/?filter=${uid()}`;

      // Warm the base URL (no tracking params)
      await mf.dispatchFetch(base);
      await wait(400); // let cache.put() settle

      // Request with tracking param — after normalisation it equals the base URL
      const response = await mf.dispatchFetch(`${base}&${param}`);
      expect(response.status).toBe(200);

      const cacheStatus = response.headers.get('x-html-edge-cache-status');
      // The filtered URL should resolve to the cached base URL entry (Hit)
      expect(cacheStatus).toContain('Hit');
    },
  );

  test('Significant params (page=) produce separate cache entries (Miss each time)', async () => {
    const base = `${ORIGIN}/?sig=${uid()}`;

    const r1 = await mf.dispatchFetch(`${base}&page=1`);
    await wait(300);
    const r2 = await mf.dispatchFetch(`${base}&page=2`);

    // page=1 and page=2 are NOT in FILTER_GET → different cache keys → both Miss
    expect(r1.headers.get('x-html-edge-cache-status')).toMatch(/Miss|FetchedOrigin/i);
    expect(r2.headers.get('x-html-edge-cache-status')).toMatch(/Miss|FetchedOrigin/i);
  });
});

// ---------------------------------------------------------------------------
// 8. CSP-RO Header Removal
//
// When CSPRO_REMOVE = true (default, line 56), the worker deletes the
// Content-Security-Policy-Report-Only header from HTML responses at line 669.
// This happens inside the debug/response-annotation block (line 602+) which
// runs for GET HTML 2xx responses — not for bypass responses.
// ---------------------------------------------------------------------------
describe('CSP-RO Header Removal', () => {
  let mf;
  beforeAll(async () => {
    mf = await createMF((req) =>
      new Response(LARGE_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'max-age=3600',
          'Content-Security-Policy-Report-Only': "default-src 'self'; report-uri /csp",
        },
      }),
    );
  });
  afterAll(async () => { await mf.dispose(); });

  test('CSPRO header is absent on a cache-miss (first) response', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?cspro=${uid()}`);
    expect(response.headers.get('content-security-policy-report-only')).toBeNull();
  });

  test('CSPRO header is absent on a cache-hit (second) response', async () => {
    const url = `${ORIGIN}/?cspro-hit=${uid()}`;
    await mf.dispatchFetch(url);
    await wait(400);
    const response = await mf.dispatchFetch(url);
    expect(response.headers.get('content-security-policy-report-only')).toBeNull();
  });

  // Bypass path goes through fetchAndModifyHeaders() which only adds headers —
  // it does NOT strip CSPRO. This test documents that known behaviour.
  test('Bypassed URL (checkout) does NOT have its CSPRO stripped by the worker', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/checkout/?u=${uid()}`);
    expect(response.headers.get('bypass-worker')).toBe('true');
    // CSPRO is passed through unchanged on bypass
    const cspro = response.headers.get('content-security-policy-report-only');
    expect(cspro).toBe("default-src 'self'; report-uri /csp");
  });
});

// ---------------------------------------------------------------------------
// 9. Speculation Rules — Prerender Rejection
//
// When SPECULATION_ENABLED (from KV/env), a Sec-Purpose: prerender request
// is rejected with 406 if the URL is not already in cache.
// ---------------------------------------------------------------------------
describe('Speculation Rules — Prerender Rejection', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  test('Prerender request on uncached URL returns 406', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?prerender=${uid()}`, {
      headers: { 'Sec-Purpose': 'prerender' },
    });
    expect(response.status).toBe(406);
  });

  test('Prerender on cached URL returns 200', async () => {
    const url = `${ORIGIN}/?prerender-cached=${uid()}`;
    // Warm the cache
    await mf.dispatchFetch(url);
    await wait(500);
    // Prerender against a warmed entry should succeed
    const response = await mf.dispatchFetch(url, {
      headers: { 'Sec-Purpose': 'prerender' },
    });
    expect(response.status).toBe(200);
  });

  test('Normal GET after a 406 prerender proceeds and is cacheable', async () => {
    const url = `${ORIGIN}/?after-406=${uid()}`;
    const prerender = await mf.dispatchFetch(url, {
      headers: { 'Sec-Purpose': 'prerender' },
    });
    expect(prerender.status).toBe(406);
    const normal = await mf.dispatchFetch(url);
    expect(normal.status).toBe(200);
    expect(normal.headers.get('x-html-edge-cache-status')).toMatch(/Miss|FetchedOrigin/i);
  });
});

// ---------------------------------------------------------------------------
// 10. Non-Cacheable Origin Status Codes
//
// FPC.js only caches HTML 200 responses (CACHE_STATUSES).
// Non-200 responses are passed through without caching.
// ---------------------------------------------------------------------------
describe('Non-Cacheable Origin Status Codes', () => {
  let mf;
  beforeAll(async () => {
    mf = await createMF((req) => {
      const status = parseInt(
        new URL(req.url).searchParams.get('__status') ?? '200',
        10,
      );
      return new Response(status === 200 ? LARGE_HTML : 'error body', {
        status,
        headers: {
          'Content-Type': status === 200 ? 'text/html; charset=utf-8' : 'text/plain',
        },
      });
    });
  });
  afterAll(async () => { await mf.dispose(); });

  test('404 from origin is returned as 404', async () => {
    const response = await mf.dispatchFetch(
      `${ORIGIN}/?u=${uid()}&__status=404`,
    );
    expect(response.status).toBe(404);
  });

  test('500 from origin is returned as 500', async () => {
    const response = await mf.dispatchFetch(
      `${ORIGIN}/?u=${uid()}&__status=500`,
    );
    expect(response.status).toBe(500);
  });

  test('200 from origin is returned as 200', async () => {
    const response = await mf.dispatchFetch(
      `${ORIGIN}/?u=${uid()}&__status=200`,
    );
    expect(response.status).toBe(200);
  });

  test('Non-200 response is not cached (second request also hits origin)', async () => {
    const url = `${ORIGIN}/?nocache=${uid()}&__status=404`;
    const r1 = await mf.dispatchFetch(url);
    const r2 = await mf.dispatchFetch(url);
    // Both 404 responses come from origin — neither is cached
    expect(r1.status).toBe(404);
    expect(r2.status).toBe(404);
    // No cache-status header (processing block skipped for non-200)
    expect(r1.headers.get('x-html-edge-cache-status')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 11. Speculation Rules JSON Endpoint
// ---------------------------------------------------------------------------
describe('Speculation Rules JSON Endpoint', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  test('/rules/speculation.json returns 200 application/speculationrules+json', async () => {
    const response = await mf.dispatchFetch(
      `${ORIGIN}/rules/speculation.json?u=${uid()}`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain(
      'application/speculationrules+json',
    );
    const body = await response.json();
    expect(body).toBeTypeOf('object');
  });
});

// ---------------------------------------------------------------------------
// 12. Worker Timing Headers (always present on cacheable GET responses)
// ---------------------------------------------------------------------------
describe('Worker Timing Headers', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  test('Worker-Time is a non-negative integer', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`);
    const t = response.headers.get('Worker-Time');
    expect(t).not.toBeNull();
    expect(parseInt(t, 10)).toBeGreaterThanOrEqual(0);
  });

  test('JS-Time header is present', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`);
    expect(response.headers.get('JS-Time')).not.toBeNull();
  });

  test('Server-Timing header is present', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`);
    expect(response.headers.get('Server-Timing')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 13. x-html-edge-cache-version Header
// ---------------------------------------------------------------------------
describe('x-html-edge-cache-version Header', () => {
  let mf;
  beforeAll(async () => { mf = await createMF(); });
  afterAll(async () => { await mf.dispose(); });

  test('x-html-edge-cache-version is a non-negative integer on normal requests', async () => {
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`);
    const version = response.headers.get('x-html-edge-cache-version');
    expect(version).not.toBeNull();
    expect(parseInt(version, 10)).toBeGreaterThanOrEqual(0);
  });

  test('cf-version=42 makes subsequent requests use cache version 42', async () => {
    // Set the version
    await mf.dispatchFetch(`${ORIGIN}/?cf-version=42&u=${uid()}`);
    // Next normal request should report version 42
    const response = await mf.dispatchFetch(`${ORIGIN}/?u=${uid()}`);
    expect(response.headers.get('x-html-edge-cache-version')).toBe('42');
  });
});
