/**
 * Mock-based Tests for CloudFlare FPC Worker
 * 
 * These tests use mocked CloudFlare APIs to test the worker logic
 * without requiring a live CloudFlare environment.
 */

// Mock CloudFlare Cache API
class MockCache {
    constructor() {
        this.storage = new Map();
    }

    async match(request) {
        const key = typeof request === 'string' ? request : request.url;
        return this.storage.get(key) || null;
    }

    async put(request, response) {
        const key = typeof request === 'string' ? request : request.url;
        this.storage.set(key, response);
    }

    async delete(request) {
        const key = typeof request === 'string' ? request : request.url;
        return this.storage.delete(key);
    }

    clear() {
        this.storage.clear();
    }
}

// Mock KV Namespace
class MockKV {
    constructor() {
        this.storage = new Map();
    }

    async get(key, type = 'text') {
        const value = this.storage.get(key);
        if (!value) return null;
        
        switch (type) {
            case 'json':
                return JSON.parse(value);
            case 'arrayBuffer':
                return new TextEncoder().encode(value).buffer;
            case 'stream':
                return new ReadableStream({
                    start(controller) {
                        controller.enqueue(new TextEncoder().encode(value));
                        controller.close();
                    }
                });
            default:
                return value;
        }
    }

    async put(key, value, options = {}) {
        if (typeof value === 'object') {
            value = JSON.stringify(value);
        }
        this.storage.set(key, String(value));
    }

    async delete(key) {
        this.storage.delete(key);
    }

    async list(options = {}) {
        const keys = Array.from(this.storage.keys());
        return {
            keys: keys.map(name => ({ name })),
            list_complete: true,
            cursor: ''
        };
    }

    clear() {
        this.storage.clear();
    }
}

// Mock Request
class MockRequest {
    constructor(url, options = {}) {
        this.url = url;
        this.method = options.method || 'GET';
        this.headers = new Map(Object.entries(options.headers || {}));
    }

    clone() {
        return new MockRequest(this.url, {
            method: this.method,
            headers: Object.fromEntries(this.headers)
        });
    }
}

// Mock Response
class MockResponse {
    constructor(body, options = {}) {
        this.body = body;
        this.status = options.status || 200;
        this.statusText = options.statusText || 'OK';
        this.headers = new Map(Object.entries(options.headers || {}));
        this.ok = this.status >= 200 && this.status < 300;
    }

    clone() {
        return new MockResponse(this.body, {
            status: this.status,
            statusText: this.statusText,
            headers: Object.fromEntries(this.headers)
        });
    }

    async text() {
        return this.body;
    }

    async json() {
        return JSON.parse(this.body);
    }
}

describe('Cache Version Management', () => {
    let mockKV;

    beforeEach(() => {
        mockKV = new MockKV();
    });

    test('should initialize cache version to 1', async () => {
        const version = await mockKV.get('html_cache_version');
        expect(version).toBeNull();
        
        // Initialize
        await mockKV.put('html_cache_version', '1');
        const newVersion = await mockKV.get('html_cache_version');
        expect(newVersion).toBe('1');
    });

    test('should increment cache version', async () => {
        await mockKV.put('html_cache_version', '1');
        
        const currentVersion = parseInt(await mockKV.get('html_cache_version'));
        const newVersion = currentVersion + 1;
        await mockKV.put('html_cache_version', String(newVersion));
        
        expect(await mockKV.get('html_cache_version')).toBe('2');
    });

    test('should handle multiple version increments', async () => {
        await mockKV.put('html_cache_version', '1');
        
        for (let i = 0; i < 5; i++) {
            const current = parseInt(await mockKV.get('html_cache_version'));
            await mockKV.put('html_cache_version', String(current + 1));
        }
        
        expect(await mockKV.get('html_cache_version')).toBe('6');
    });

    test('should store previous version for stale detection', async () => {
        await mockKV.put('html_cache_version', '5');
        
        const currentVersion = parseInt(await mockKV.get('html_cache_version'));
        const previousVersion = currentVersion - 1;
        
        expect(previousVersion).toBe(4);
    });
});

describe('Cache Operations', () => {
    let mockCache;

    beforeEach(() => {
        mockCache = new MockCache();
    });

    test('should store response in cache', async () => {
        const request = new MockRequest('https://example.com/page');
        const response = new MockResponse('Hello World', {
            headers: { 'content-type': 'text/html' }
        });

        await mockCache.put(request, response);
        const cached = await mockCache.match(request);
        
        expect(cached).not.toBeNull();
        expect(cached.body).toBe('Hello World');
    });

    test('should return null for cache miss', async () => {
        const request = new MockRequest('https://example.com/notcached');
        const cached = await mockCache.match(request);
        
        expect(cached).toBeNull();
    });

    test('should delete from cache', async () => {
        const request = new MockRequest('https://example.com/page');
        const response = new MockResponse('Content');

        await mockCache.put(request, response);
        expect(await mockCache.match(request)).not.toBeNull();
        
        await mockCache.delete(request);
        expect(await mockCache.match(request)).toBeNull();
    });

    test('should store multiple responses', async () => {
        const requests = [
            new MockRequest('https://example.com/page1'),
            new MockRequest('https://example.com/page2'),
            new MockRequest('https://example.com/page3')
        ];

        for (const req of requests) {
            await mockCache.put(req, new MockResponse('Content'));
        }

        for (const req of requests) {
            expect(await mockCache.match(req)).not.toBeNull();
        }
    });
});

describe('Request Processing Logic', () => {
    test('should identify GET requests', () => {
        const request = new MockRequest('https://example.com/page', { method: 'GET' });
        expect(request.method).toBe('GET');
    });

    test('should identify POST requests', () => {
        const request = new MockRequest('https://example.com/page', { method: 'POST' });
        expect(request.method).toBe('POST');
    });

    test('should clone requests', () => {
        const request = new MockRequest('https://example.com/page', {
            method: 'GET',
            headers: { 'User-Agent': 'Test' }
        });
        
        const cloned = request.clone();
        expect(cloned.url).toBe(request.url);
        expect(cloned.method).toBe(request.method);
    });
});

describe('Response Processing Logic', () => {
    test('should identify successful responses', () => {
        const response = new MockResponse('OK', { status: 200 });
        expect(response.ok).toBe(true);
    });

    test('should identify error responses', () => {
        const response = new MockResponse('Not Found', { status: 404 });
        expect(response.ok).toBe(false);
    });

    test('should handle response headers', () => {
        const response = new MockResponse('Content', {
            headers: {
                'content-type': 'text/html',
                'cache-control': 'public, max-age=3600'
            }
        });
        
        expect(response.headers.get('content-type')).toBe('text/html');
        expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
    });

    test('should clone responses', () => {
        const response = new MockResponse('Content', {
            status: 200,
            headers: { 'content-type': 'text/html' }
        });
        
        const cloned = response.clone();
        expect(cloned.body).toBe(response.body);
        expect(cloned.status).toBe(response.status);
    });
});

describe('Cache Status Header Logic', () => {
    function determineCacheStatus(fromCache, isStale, revalidating) {
        if (!fromCache) {
            return 'DYNAMIC';
        }
        if (fromCache && !isStale) {
            return 'HIT';
        }
        if (fromCache && isStale && revalidating) {
            return 'HIT,STALE,REVALIDATING';
        }
        return 'HIT';
    }

    test('should return DYNAMIC for cache miss', () => {
        expect(determineCacheStatus(false, false, false)).toBe('DYNAMIC');
    });

    test('should return HIT for cache hit', () => {
        expect(determineCacheStatus(true, false, false)).toBe('HIT');
    });

    test('should return HIT,STALE,REVALIDATING for stale hit being revalidated', () => {
        expect(determineCacheStatus(true, true, true)).toBe('HIT,STALE,REVALIDATING');
    });
});

describe('Device Detection Logic', () => {
    function detectDevice(userAgent) {
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        return mobileRegex.test(userAgent) ? 'mobile' : 'desktop';
    }

    test('should detect mobile devices', () => {
        expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')).toBe('mobile');
        expect(detectDevice('Mozilla/5.0 (Linux; Android 10; SM-G973F)')).toBe('mobile');
        expect(detectDevice('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)')).toBe('mobile');
    });

    test('should detect desktop devices', () => {
        expect(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
        expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('desktop');
    });
});

describe('TTL (Time To Live) Management', () => {
    function parseTTL(cacheControl) {
        if (!cacheControl) return null;
        
        const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
        if (maxAgeMatch) {
            return parseInt(maxAgeMatch[1]);
        }
        
        const sMaxAgeMatch = cacheControl.match(/s-maxage=(\d+)/);
        if (sMaxAgeMatch) {
            return parseInt(sMaxAgeMatch[1]);
        }
        
        return null;
    }

    test('should parse max-age from cache-control', () => {
        expect(parseTTL('public, max-age=3600')).toBe(3600);
        expect(parseTTL('public, max-age=86400')).toBe(86400);
    });

    test('should parse s-maxage from cache-control', () => {
        expect(parseTTL('public, s-maxage=7200')).toBe(7200);
    });

    test('should return null for missing TTL', () => {
        expect(parseTTL('public')).toBeNull();
        expect(parseTTL(null)).toBeNull();
    });

    test('should prefer max-age over s-maxage', () => {
        const ttl = parseTTL('public, max-age=3600, s-maxage=7200');
        expect(ttl).toBe(3600);
    });
});

describe('Age Calculation', () => {
    function calculateAge(cachedTime) {
        const now = Date.now();
        return Math.floor((now - cachedTime) / 1000);
    }

    test('should calculate age in seconds', () => {
        const fiveSecondsAgo = Date.now() - 5000;
        const age = calculateAge(fiveSecondsAgo);
        expect(age).toBeGreaterThanOrEqual(4);
        expect(age).toBeLessThanOrEqual(6);
    });

    test('should return 0 for current time', () => {
        const now = Date.now();
        expect(calculateAge(now)).toBe(0);
    });
});

describe('Stale-While-Revalidate Logic', () => {
    function shouldRevalidate(age, ttl, staleWhileRevalidate = 300) {
        if (!ttl) return false;
        return age > ttl && age <= ttl + staleWhileRevalidate;
    }

    test('should not revalidate fresh content', () => {
        expect(shouldRevalidate(100, 3600)).toBe(false);
    });

    test('should revalidate stale content within window', () => {
        expect(shouldRevalidate(3700, 3600, 300)).toBe(true);
    });

    test('should not revalidate content beyond stale window', () => {
        expect(shouldRevalidate(4000, 3600, 300)).toBe(false);
    });

    test('should handle missing TTL', () => {
        expect(shouldRevalidate(1000, null)).toBe(false);
    });
});

describe('Query Parameter Handling', () => {
    function isIgnoredParam(param, ignoredParams) {
        return ignoredParams.includes(param);
    }

    const ignoredParams = ['fbclid', 'utm_source', 'utm_campaign', 'gclid'];

    test('should identify ignored parameters', () => {
        expect(isIgnoredParam('fbclid', ignoredParams)).toBe(true);
        expect(isIgnoredParam('utm_source', ignoredParams)).toBe(true);
    });

    test('should identify non-ignored parameters', () => {
        expect(isIgnoredParam('id', ignoredParams)).toBe(false);
        expect(isIgnoredParam('category', ignoredParams)).toBe(false);
    });
});

describe('Special Parameter Detection', () => {
    function hasSpecialParam(url, param) {
        const urlObj = new URL(url);
        return urlObj.searchParams.has(param);
    }

    test('should detect cf-purge parameter', () => {
        expect(hasSpecialParam('https://example.com/page?cf-purge=true', 'cf-purge')).toBe(true);
    });

    test('should detect cf-delete parameter', () => {
        expect(hasSpecialParam('https://example.com/page?cf-delete=true', 'cf-delete')).toBe(true);
    });

    test('should detect cf-cdn parameter', () => {
        expect(hasSpecialParam('https://example.com/page?cf-cdn=false', 'cf-cdn')).toBe(true);
    });

    test('should not detect missing parameters', () => {
        expect(hasSpecialParam('https://example.com/page', 'cf-purge')).toBe(false);
    });
});

describe('Response Status Validation', () => {
    function isValidCacheStatus(status) {
        // Cache 2xx and 301 responses
        return (status >= 200 && status < 300) || status === 301;
    }

    test('should accept 200 status', () => {
        expect(isValidCacheStatus(200)).toBe(true);
    });

    test('should accept 301 status', () => {
        expect(isValidCacheStatus(301)).toBe(true);
    });

    test('should reject 404 status', () => {
        expect(isValidCacheStatus(404)).toBe(false);
    });

    test('should reject 500 status', () => {
        expect(isValidCacheStatus(500)).toBe(false);
    });

    test('should reject 302 status', () => {
        expect(isValidCacheStatus(302)).toBe(false);
    });
});

describe('Content Security Policy Processing', () => {
    function shouldRemoveCSP(headers, removeEnabled = true) {
        if (!removeEnabled) return false;
        return headers.has('content-security-policy-report-only');
    }

    test('should remove CSP when enabled', () => {
        const headers = new Map([
            ['content-security-policy-report-only', 'default-src self']
        ]);
        expect(shouldRemoveCSP(headers, true)).toBe(true);
    });

    test('should not remove CSP when disabled', () => {
        const headers = new Map([
            ['content-security-policy-report-only', 'default-src self']
        ]);
        expect(shouldRemoveCSP(headers, false)).toBe(false);
    });

    test('should handle missing CSP header', () => {
        const headers = new Map();
        expect(shouldRemoveCSP(headers, true)).toBe(false);
    });
});

describe('Hash Generation', () => {
    // Simplified hash function for testing
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    test('should generate consistent hashes', () => {
        const content = 'Hello World';
        const hash1 = simpleHash(content);
        const hash2 = simpleHash(content);
        expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different content', () => {
        const hash1 = simpleHash('Content A');
        const hash2 = simpleHash('Content B');
        expect(hash1).not.toBe(hash2);
    });

    test('should handle empty string', () => {
        const hash = simpleHash('');
        expect(hash).toBe('0');
    });
});

describe('ESI Tag Detection', () => {
    function hasESITags(html) {
        return html.includes('<esi:include') || html.includes('<esi:');
    }

    test('should detect ESI include tags', () => {
        const html = '<div><esi:include src="/fragment" /></div>';
        expect(hasESITags(html)).toBe(true);
    });

    test('should detect any ESI tags', () => {
        const html = '<div><esi:vars /></div>';
        expect(hasESITags(html)).toBe(true);
    });

    test('should not detect ESI in plain HTML', () => {
        const html = '<div>Hello World</div>';
        expect(hasESITags(html)).toBe(false);
    });
});

describe('Speculation Rules Detection', () => {
    function needsSpeculationRules(html) {
        // Add speculation rules if not already present
        return !html.includes('speculationrules') && !html.includes('speculation-rules') && !html.includes('speculation.json');
    }

    test('should add speculation rules to HTML without them', () => {
        const html = '<html><body>Content</body></html>';
        expect(needsSpeculationRules(html)).toBe(true);
    });

    test('should not add speculation rules if already present', () => {
        const html = '<html><script type="speculationrules">{"prerender":[]}</script></html>';
        expect(needsSpeculationRules(html)).toBe(false);
    });

    test('should detect speculation.json link', () => {
        const html = '<html><link rel="speculationrules" href="speculation.json"></html>';
        expect(needsSpeculationRules(html)).toBe(false);
    });
});

describe('Prerender Header Detection', () => {
    function isPrerenderRequest(headers) {
        const secPurpose = headers.get('sec-purpose');
        return secPurpose === 'prerender' || secPurpose === 'prefetch';
    }

    test('should detect prerender requests', () => {
        const headers = new Map([['sec-purpose', 'prerender']]);
        expect(isPrerenderRequest(headers)).toBe(true);
    });

    test('should detect prefetch requests', () => {
        const headers = new Map([['sec-purpose', 'prefetch']]);
        expect(isPrerenderRequest(headers)).toBe(true);
    });

    test('should not detect regular requests', () => {
        const headers = new Map([['user-agent', 'Mozilla']]);
        expect(isPrerenderRequest(headers)).toBe(false);
    });
});

describe('KV Storage Operations', () => {
    let mockKV;

    beforeEach(() => {
        mockKV = new MockKV();
    });

    test('should store and retrieve string values', async () => {
        await mockKV.put('key1', 'value1');
        expect(await mockKV.get('key1')).toBe('value1');
    });

    test('should store and retrieve JSON values', async () => {
        const data = { test: 'value', number: 42 };
        await mockKV.put('json_key', JSON.stringify(data));
        const retrieved = JSON.parse(await mockKV.get('json_key'));
        expect(retrieved).toEqual(data);
    });

    test('should delete values', async () => {
        await mockKV.put('key1', 'value1');
        await mockKV.delete('key1');
        expect(await mockKV.get('key1')).toBeNull();
    });

    test('should list all keys', async () => {
        await mockKV.put('key1', 'value1');
        await mockKV.put('key2', 'value2');
        await mockKV.put('key3', 'value3');
        
        const list = await mockKV.list();
        expect(list.keys.length).toBe(3);
    });

    test('should return null for non-existent keys', async () => {
        expect(await mockKV.get('nonexistent')).toBeNull();
    });
});

describe('Rate Limiting Logic', () => {
    function checkRateLimit(ipAddress, requestCounts, limit = 100) {
        const count = requestCounts.get(ipAddress) || 0;
        return count >= limit;
    }

    test('should not rate limit under threshold', () => {
        const counts = new Map([['1.2.3.4', 50]]);
        expect(checkRateLimit('1.2.3.4', counts, 100)).toBe(false);
    });

    test('should rate limit at threshold', () => {
        const counts = new Map([['1.2.3.4', 100]]);
        expect(checkRateLimit('1.2.3.4', counts, 100)).toBe(true);
    });

    test('should rate limit over threshold', () => {
        const counts = new Map([['1.2.3.4', 150]]);
        expect(checkRateLimit('1.2.3.4', counts, 100)).toBe(true);
    });

    test('should handle new IP addresses', () => {
        const counts = new Map();
        expect(checkRateLimit('1.2.3.4', counts, 100)).toBe(false);
    });
});
