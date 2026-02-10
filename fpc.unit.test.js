/**
 * Unit Tests for CloudFlare FPC Worker Helper Functions
 * 
 * These tests validate individual helper functions without requiring
 * a live CloudFlare environment or network requests.
 */

// Import necessary functions from FPC.js
// Since FPC.js is a CloudFlare Worker script, we'll need to extract and export functions
// For now, we'll duplicate the functions here for testing purposes

/**
 * Parse Boolean helper function
 */
function parseBoolean(str) {
    if (typeof str !== 'string') {
        return false;
    }
    switch (str.toLowerCase().trim()) {
        case 'true':
        case '1':
        case 'yes':
            return true;
        case 'false':
        case '0':
        case 'no':
        case '':
            return false;
        default:
            return false;
    }
}

/**
 * Get Cookie helper function
 */
function getCookie(cookies, name) {
    name = name + "=";
    let decodedCookie = decodeURIComponent(cookies);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return null;
}

/**
 * Check Cookies helper function
 */
function checkCookies(cookieHeader, bypassCookies) {
    let bypassCache = false;
    if (cookieHeader && cookieHeader.length && bypassCookies.length) {
        const cookies = cookieHeader.split(';');
        for (let cookie of cookies) {
            for (let prefix of bypassCookies) {
                if (cookie.trim().startsWith(prefix + "=")) {
                    bypassCache = true;
                    break;
                }
            }
            if (bypassCache) {
                break;
            }
        }
    }
    return bypassCache;
}

/**
 * Normalize URL helper function (simplified for testing)
 */
function normalizeUrl(url, filterGet = [], allowedGetOnly = false, allowedGet = []) {
    const normalizedUrl = new URL(url.toString());

    if (allowedGetOnly) {
        [...normalizedUrl.searchParams.keys()].forEach((key) => {
            if (!allowedGet.includes(key)) {
                normalizedUrl.searchParams.delete(key);
            }
        });
    } else {
        filterGet.forEach((key) => {
            normalizedUrl.searchParams.delete(key);
        });
    }

    const uniqueParams = new Map();
    for (const [key, value] of normalizedUrl.searchParams.entries()) {
        if (!uniqueParams.has(key)) {
            uniqueParams.set(key, value);
        }
    }

    const sortedParams = new URLSearchParams();
    [...uniqueParams.entries()]
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .forEach(([key, value]) => {
            sortedParams.append(key, value);
        });

    normalizedUrl.search = sortedParams.toString();
    return normalizedUrl;
}

describe('parseBoolean', () => {
    test('should return true for "true" string', () => {
        expect(parseBoolean('true')).toBe(true);
    });

    test('should return true for "TRUE" (case insensitive)', () => {
        expect(parseBoolean('TRUE')).toBe(true);
    });

    test('should return true for "1"', () => {
        expect(parseBoolean('1')).toBe(true);
    });

    test('should return true for "yes"', () => {
        expect(parseBoolean('yes')).toBe(true);
    });

    test('should return true for "YES" (case insensitive)', () => {
        expect(parseBoolean('YES')).toBe(true);
    });

    test('should return false for "false" string', () => {
        expect(parseBoolean('false')).toBe(false);
    });

    test('should return false for "0"', () => {
        expect(parseBoolean('0')).toBe(false);
    });

    test('should return false for "no"', () => {
        expect(parseBoolean('no')).toBe(false);
    });

    test('should return false for empty string', () => {
        expect(parseBoolean('')).toBe(false);
    });

    test('should return false for invalid string', () => {
        expect(parseBoolean('invalid')).toBe(false);
    });

    test('should return false for non-string input (number)', () => {
        expect(parseBoolean(123)).toBe(false);
    });

    test('should return false for non-string input (object)', () => {
        expect(parseBoolean({})).toBe(false);
    });

    test('should return false for non-string input (null)', () => {
        expect(parseBoolean(null)).toBe(false);
    });

    test('should return false for non-string input (undefined)', () => {
        expect(parseBoolean(undefined)).toBe(false);
    });

    test('should handle whitespace', () => {
        expect(parseBoolean('  true  ')).toBe(true);
        expect(parseBoolean('  false  ')).toBe(false);
    });
});

describe('getCookie', () => {
    test('should extract cookie value by name', () => {
        const cookies = 'name=John; age=30; city=NewYork';
        expect(getCookie(cookies, 'name')).toBe('John');
        expect(getCookie(cookies, 'age')).toBe('30');
        expect(getCookie(cookies, 'city')).toBe('NewYork');
    });

    test('should return null for non-existent cookie', () => {
        const cookies = 'name=John; age=30';
        expect(getCookie(cookies, 'missing')).toBeNull();
    });

    test('should handle cookies with spaces', () => {
        const cookies = 'name=John Doe; age=30';
        expect(getCookie(cookies, 'name')).toBe('John Doe');
    });

    test('should handle URL-encoded cookies', () => {
        const cookies = 'name=John%20Doe; data=%7B%22key%22%3A%22value%22%7D';
        expect(getCookie(cookies, 'name')).toBe('John Doe');
        expect(getCookie(cookies, 'data')).toBe('{"key":"value"}');
    });

    test('should handle single cookie', () => {
        const cookies = 'token=abc123';
        expect(getCookie(cookies, 'token')).toBe('abc123');
    });

    test('should handle cookie with equals sign in value', () => {
        const cookies = 'equation=x=y+z';
        expect(getCookie(cookies, 'equation')).toBe('x=y+z');
    });

    test('should handle empty cookie string', () => {
        expect(getCookie('', 'name')).toBeNull();
    });

    test('should handle cookies with leading/trailing spaces', () => {
        const cookies = ' name=John ; age=30 ; city=NewYork ';
        expect(getCookie(cookies, 'name')).toBe('John ');
        expect(getCookie(cookies, 'age')).toBe('30 ');
    });

    test('should handle Magento-specific cookies', () => {
        const cookies = 'X-Magento-Vary=abc123; form_key=xyz789; admin=token123';
        expect(getCookie(cookies, 'X-Magento-Vary')).toBe('abc123');
        expect(getCookie(cookies, 'form_key')).toBe('xyz789');
        expect(getCookie(cookies, 'admin')).toBe('token123');
    });
});

describe('checkCookies', () => {
    test('should return true when bypass cookie is present', () => {
        const cookieHeader = 'admin=token123; other=value';
        const bypassCookies = ['admin'];
        expect(checkCookies(cookieHeader, bypassCookies)).toBe(true);
    });

    test('should return false when bypass cookie is not present', () => {
        const cookieHeader = 'user=John; session=abc';
        const bypassCookies = ['admin'];
        expect(checkCookies(cookieHeader, bypassCookies)).toBe(false);
    });

    test('should check multiple bypass cookies', () => {
        const cookieHeader = 'session=abc; admin_token=xyz';
        const bypassCookies = ['admin', 'admin_token'];
        expect(checkCookies(cookieHeader, bypassCookies)).toBe(true);
    });

    test('should return false with empty cookie header', () => {
        const bypassCookies = ['admin'];
        expect(checkCookies('', bypassCookies)).toBe(false);
        expect(checkCookies(null, bypassCookies)).toBe(false);
    });

    test('should return false with empty bypass cookies array', () => {
        const cookieHeader = 'admin=token123';
        expect(checkCookies(cookieHeader, [])).toBe(false);
    });

    test('should not match partial cookie names', () => {
        const cookieHeader = 'admin_test=value; test=123';
        const bypassCookies = ['admin'];
        expect(checkCookies(cookieHeader, bypassCookies)).toBe(false);
    });

    test('should match exact cookie name with equals', () => {
        const cookieHeader = 'admin=token; admin_test=other';
        const bypassCookies = ['admin'];
        expect(checkCookies(cookieHeader, bypassCookies)).toBe(true);
    });

    test('should handle cookies with spaces', () => {
        const cookieHeader = ' admin=token ; user=John ';
        const bypassCookies = ['admin'];
        expect(checkCookies(cookieHeader, bypassCookies)).toBe(true);
    });

    test('should match first bypass cookie in list', () => {
        const cookieHeader = 'token=abc; admin=xyz';
        const bypassCookies = ['admin', 'token'];
        expect(checkCookies(cookieHeader, bypassCookies)).toBe(true);
    });

    test('should handle X-Magento-Vary cookie', () => {
        const cookieHeader = 'X-Magento-Vary=abc123; other=value';
        const bypassCookies = ['X-Magento-Vary'];
        expect(checkCookies(cookieHeader, bypassCookies)).toBe(true);
    });
});

describe('normalizeUrl', () => {
    test('should remove filtered GET parameters', () => {
        const url = 'https://example.com/page?id=1&fbclid=abc&utm_source=google';
        const filterGet = ['fbclid', 'utm_source'];
        const normalized = normalizeUrl(url, filterGet);
        expect(normalized.toString()).toBe('https://example.com/page?id=1');
    });

    test('should sort query parameters alphabetically', () => {
        const url = 'https://example.com/page?z=26&a=1&m=13';
        const normalized = normalizeUrl(url, []);
        expect(normalized.toString()).toBe('https://example.com/page?a=1&m=13&z=26');
    });

    test('should remove duplicate query parameters', () => {
        const url = 'https://example.com/page?id=1&id=2&name=test';
        const normalized = normalizeUrl(url, []);
        expect(normalized.searchParams.get('id')).toBe('1');
        expect(normalized.searchParams.getAll('id').length).toBe(1);
    });

    test('should handle URLs with no query parameters', () => {
        const url = 'https://example.com/page';
        const normalized = normalizeUrl(url, []);
        expect(normalized.toString()).toBe('https://example.com/page');
    });

    test('should handle URLs with only filtered parameters', () => {
        const url = 'https://example.com/page?fbclid=abc&utm_source=google';
        const filterGet = ['fbclid', 'utm_source'];
        const normalized = normalizeUrl(url, filterGet);
        expect(normalized.toString()).toBe('https://example.com/page');
    });

    test('should preserve unfiltered parameters', () => {
        const url = 'https://example.com/page?id=1&fbclid=abc&category=shoes';
        const filterGet = ['fbclid'];
        const normalized = normalizeUrl(url, filterGet);
        expect(normalized.searchParams.get('id')).toBe('1');
        expect(normalized.searchParams.get('category')).toBe('shoes');
        expect(normalized.searchParams.has('fbclid')).toBe(false);
    });

    test('should handle allowed-only mode', () => {
        const url = 'https://example.com/page?id=1&fbclid=abc&category=shoes';
        const allowedGet = ['id', 'category'];
        const normalized = normalizeUrl(url, [], true, allowedGet);
        expect(normalized.searchParams.get('id')).toBe('1');
        expect(normalized.searchParams.get('category')).toBe('shoes');
        expect(normalized.searchParams.has('fbclid')).toBe(false);
    });

    test('should handle special characters in parameters', () => {
        const url = 'https://example.com/page?query=hello%20world&id=1';
        const normalized = normalizeUrl(url, []);
        expect(normalized.searchParams.get('query')).toBe('hello world');
    });

    test('should handle hash fragments', () => {
        const url = 'https://example.com/page?id=1#section';
        const normalized = normalizeUrl(url, []);
        expect(normalized.hash).toBe('#section');
        expect(normalized.searchParams.get('id')).toBe('1');
    });

    test('should remove common marketing parameters', () => {
        const url = 'https://example.com/page?id=1&utm_campaign=summer&gclid=abc&fbclid=xyz';
        const marketingParams = ['utm_campaign', 'gclid', 'fbclid'];
        const normalized = normalizeUrl(url, marketingParams);
        expect(normalized.toString()).toBe('https://example.com/page?id=1');
    });
});

describe('URL Bypass Logic Tests', () => {
    function shouldBypassURL(url, bypassUrls) {
        const urlObj = new URL(url);
        const searchUrl = urlObj.pathname + urlObj.search;
        return bypassUrls.some(pass => searchUrl.indexOf(pass) >= 0);
    }

    const defaultBypassUrls = [
        '/checkout/',
        '/admin/',
        '/api/',
        '/cart/',
        '/customer/',
        '/ajax'
    ];

    test('should bypass checkout URLs', () => {
        expect(shouldBypassURL('https://example.com/checkout/', defaultBypassUrls)).toBe(true);
        expect(shouldBypassURL('https://example.com/checkout/cart', defaultBypassUrls)).toBe(true);
    });

    test('should bypass admin URLs', () => {
        expect(shouldBypassURL('https://example.com/admin/', defaultBypassUrls)).toBe(true);
        expect(shouldBypassURL('https://example.com/admin/dashboard', defaultBypassUrls)).toBe(true);
    });

    test('should bypass API URLs', () => {
        expect(shouldBypassURL('https://example.com/api/products', defaultBypassUrls)).toBe(true);
        expect(shouldBypassURL('https://example.com/rest/api/v1/test', defaultBypassUrls)).toBe(true);
    });

    test('should bypass AJAX URLs', () => {
        expect(shouldBypassURL('https://example.com/ajax/endpoint', defaultBypassUrls)).toBe(true);
        expect(shouldBypassURL('https://example.com/test/ajax/data', defaultBypassUrls)).toBe(true);
    });

    test('should not bypass regular pages', () => {
        expect(shouldBypassURL('https://example.com/products', defaultBypassUrls)).toBe(false);
        expect(shouldBypassURL('https://example.com/about', defaultBypassUrls)).toBe(false);
        expect(shouldBypassURL('https://example.com/', defaultBypassUrls)).toBe(false);
    });

    test('should bypass cart URLs', () => {
        expect(shouldBypassURL('https://example.com/cart/', defaultBypassUrls)).toBe(true);
        expect(shouldBypassURL('https://example.com/shopping/cart/add', defaultBypassUrls)).toBe(true);
    });

    test('should bypass customer account URLs', () => {
        expect(shouldBypassURL('https://example.com/customer/account', defaultBypassUrls)).toBe(true);
        expect(shouldBypassURL('https://example.com/customer/orders', defaultBypassUrls)).toBe(true);
    });
});

describe('Cache Key Generation Tests', () => {
    function generateCacheKey(url, version, deviceType = 'desktop', userVary = null) {
        const normalized = normalizeUrl(url, ['fbclid', 'utm_source', 'utm_campaign']);
        let cacheKey = normalized.toString();
        
        // Add cache version parameter
        const separator = cacheKey.includes('?') ? '&' : '?';
        cacheKey += `${separator}cf_edge_cache_ver=${version}`;
        
        // Add device type if different caching for mobile
        if (deviceType !== 'desktop') {
            cacheKey += `&device=${deviceType}`;
        }
        
        // Add user variation if present
        if (userVary) {
            cacheKey += `&vary=${userVary}`;
        }
        
        return cacheKey;
    }

    test('should generate cache key with version', () => {
        const key = generateCacheKey('https://example.com/page', 1);
        expect(key).toBe('https://example.com/page?cf_edge_cache_ver=1');
    });

    test('should generate cache key with existing params', () => {
        const key = generateCacheKey('https://example.com/page?id=123', 1);
        expect(key).toContain('id=123');
        expect(key).toContain('cf_edge_cache_ver=1');
    });

    test('should generate different keys for different versions', () => {
        const key1 = generateCacheKey('https://example.com/page', 1);
        const key2 = generateCacheKey('https://example.com/page', 2);
        expect(key1).not.toBe(key2);
    });

    test('should include device type in cache key', () => {
        const key = generateCacheKey('https://example.com/page', 1, 'mobile');
        expect(key).toContain('device=mobile');
    });

    test('should include user variation in cache key', () => {
        const key = generateCacheKey('https://example.com/page', 1, 'desktop', 'abc123');
        expect(key).toContain('vary=abc123');
    });

    test('should filter marketing params from cache key', () => {
        const key = generateCacheKey('https://example.com/page?id=1&fbclid=abc', 1);
        expect(key).not.toContain('fbclid');
        expect(key).toContain('id=1');
    });
});

describe('Response Header Processing Tests', () => {
    function shouldCacheResponse(status, headers) {
        // Only cache 2xx and 301 responses
        if (status < 200 || (status >= 300 && status !== 301)) {
            return false;
        }
        
        // Check cache control headers
        const cacheControl = headers['cache-control'] || '';
        if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
            return false;
        }
        
        // Check for private cache
        if (cacheControl.includes('private')) {
            return false;
        }
        
        return true;
    }

    test('should cache 200 responses', () => {
        expect(shouldCacheResponse(200, {})).toBe(true);
    });

    test('should cache 301 responses', () => {
        expect(shouldCacheResponse(301, {})).toBe(true);
    });

    test('should not cache 404 responses', () => {
        expect(shouldCacheResponse(404, {})).toBe(false);
    });

    test('should not cache 500 responses', () => {
        expect(shouldCacheResponse(500, {})).toBe(false);
    });

    test('should not cache with no-cache header', () => {
        expect(shouldCacheResponse(200, { 'cache-control': 'no-cache' })).toBe(false);
    });

    test('should not cache with no-store header', () => {
        expect(shouldCacheResponse(200, { 'cache-control': 'no-store' })).toBe(false);
    });

    test('should not cache with private header', () => {
        expect(shouldCacheResponse(200, { 'cache-control': 'private' })).toBe(false);
    });

    test('should cache with public header', () => {
        expect(shouldCacheResponse(200, { 'cache-control': 'public, max-age=3600' })).toBe(true);
    });

    test('should not cache 302 redirects', () => {
        expect(shouldCacheResponse(302, {})).toBe(false);
    });
});

describe('Configuration Value Parsing Tests', () => {
    function parseConfigValue(value, type = 'bool', defaultValue = true) {
        if (value === undefined) {
            return defaultValue;
        }

        switch (type) {
            case 'bool':
                if (value === "false" || value === false) {
                    return false;
                }
                return true;
            case 'string':
            case 'str':
                return String(value);
            case 'integer':
            case 'int':
                return parseInt(value);
            case 'float':
                return parseFloat(value);
            case 'object':
            case 'obj':
                if (typeof value === "string") {
                    return JSON.parse(value);
                }
                return value;
            case 'array':
                if (typeof value === "string") {
                    return JSON.parse(value);
                }
                return value;
            default:
                return defaultValue;
        }
    }

    test('should parse boolean true', () => {
        expect(parseConfigValue('true', 'bool')).toBe(true);
        expect(parseConfigValue(true, 'bool')).toBe(true);
    });

    test('should parse boolean false', () => {
        expect(parseConfigValue('false', 'bool')).toBe(false);
        expect(parseConfigValue(false, 'bool')).toBe(false);
    });

    test('should parse integer values', () => {
        expect(parseConfigValue('42', 'int')).toBe(42);
        expect(parseConfigValue('0', 'int')).toBe(0);
        expect(parseConfigValue('-10', 'int')).toBe(-10);
    });

    test('should parse float values', () => {
        expect(parseConfigValue('3.14', 'float')).toBe(3.14);
        expect(parseConfigValue('0.5', 'float')).toBe(0.5);
    });

    test('should parse string values', () => {
        expect(parseConfigValue('test', 'string')).toBe('test');
        expect(parseConfigValue(123, 'string')).toBe('123');
    });

    test('should parse JSON object', () => {
        const json = '{"key":"value"}';
        expect(parseConfigValue(json, 'object')).toEqual({ key: 'value' });
    });

    test('should parse JSON array', () => {
        const json = '[1,2,3]';
        expect(parseConfigValue(json, 'array')).toEqual([1, 2, 3]);
    });

    test('should use default value when undefined', () => {
        expect(parseConfigValue(undefined, 'bool', true)).toBe(true);
        expect(parseConfigValue(undefined, 'int', 42)).toBe(42);
    });
});
