/**
 * Simple validation script to test the modular architecture
 * Run with: node validate-structure.js
 */

import { getConfigManager } from './src/config/ConfigManager.js';
import { CacheManager } from './src/cache/CacheManager.js';
import { URLHandler } from './src/utils/URLHandler.js';
import { CookieHandler } from './src/utils/CookieHandler.js';
import { ResponseProcessor } from './src/processors/ResponseProcessor.js';
import { RequestHandler } from './src/RequestHandler.js';
import { createLogger } from './src/utils/Logger.js';

console.log('🧪 Validating Modular Architecture...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.error(`   Error: ${error.message}`);
        failed++;
    }
}

// Test ConfigManager
test('ConfigManager: Can be instantiated', () => {
    const config = getConfigManager();
    if (!config) throw new Error('Config is null');
});

test('ConfigManager: Has get method', () => {
    const config = getConfigManager();
    if (typeof config.get !== 'function') throw new Error('get method missing');
});

test('ConfigManager: Has isEnabled method', () => {
    const config = getConfigManager();
    if (typeof config.isEnabled !== 'function') throw new Error('isEnabled method missing');
});

test('ConfigManager: Can get default values', () => {
    const config = getConfigManager();
    const value = config.get('nonexistent', 'default');
    if (value !== 'default') throw new Error('Default value not returned');
});

// Test CacheManager
test('CacheManager: Can be instantiated', () => {
    const config = getConfigManager();
    const cacheManager = new CacheManager(config);
    if (!cacheManager) throw new Error('CacheManager is null');
});

test('CacheManager: Has cache methods', () => {
    const config = getConfigManager();
    const cacheManager = new CacheManager(config);
    if (typeof cacheManager.getCurrentCacheVersion !== 'function') {
        throw new Error('getCurrentCacheVersion missing');
    }
    if (typeof cacheManager.getFromCDN !== 'function') {
        throw new Error('getFromCDN missing');
    }
});

// Test URLHandler
test('URLHandler: Can normalize URL', () => {
    const url = new URL('https://example.com/?gclid=123&p=1');
    const normalized = URLHandler.normalizeUrl(url);
    if (normalized.searchParams.has('gclid')) {
        throw new Error('Tracking param not filtered');
    }
    if (!normalized.searchParams.has('p')) {
        throw new Error('Valid param was filtered');
    }
});

test('URLHandler: Can extract worker params', () => {
    const url = new URL('https://example.com/?cf-cdn=false');
    const params = URLHandler.extractWorkerParams(url);
    if (!params.bypassCDN) {
        throw new Error('Failed to extract worker params');
    }
});

test('URLHandler: Can generate cache key', () => {
    const request = new Request('https://example.com/test');
    const cacheKey = URLHandler.generateCacheKey(request, 1);
    if (!cacheKey.includes('cf_edge_cache_ver=1')) {
        throw new Error('Cache key missing version');
    }
});

// Test CookieHandler
test('CookieHandler: Can parse cookies', () => {
    const cookieValue = CookieHandler.getCookie('test=value; foo=bar', 'test');
    if (cookieValue !== 'value') {
        throw new Error('Cookie not parsed correctly');
    }
});

test('CookieHandler: Can check bypass cookies', () => {
    const cookieString = 'admin=1; other=test';
    const shouldBypass = CookieHandler.checkCookies(cookieString, ['admin']);
    if (!shouldBypass) {
        throw new Error('Bypass cookie not detected');
    }
});

// Test ResponseProcessor
test('ResponseProcessor: Can be instantiated', () => {
    const config = getConfigManager();
    const processor = new ResponseProcessor(config);
    if (!processor) throw new Error('ResponseProcessor is null');
});

test('ResponseProcessor: Has process methods', () => {
    const config = getConfigManager();
    const processor = new ResponseProcessor(config);
    if (typeof processor.processResponse !== 'function') {
        throw new Error('processResponse missing');
    }
});

// Test Logger
test('Logger: Can be created', () => {
    const config = getConfigManager();
    const logger = createLogger(config);
    if (!logger) throw new Error('Logger is null');
});

test('Logger: Has log methods', () => {
    const config = getConfigManager();
    const logger = createLogger(config);
    if (typeof logger.debug !== 'function') throw new Error('debug missing');
    if (typeof logger.info !== 'function') throw new Error('info missing');
    if (typeof logger.error !== 'function') throw new Error('error missing');
});

// Test RequestHandler
test('RequestHandler: Can be instantiated', () => {
    const config = getConfigManager();
    const cacheManager = new CacheManager(config);
    const responseProcessor = new ResponseProcessor(config);
    const requestHandler = new RequestHandler(config, cacheManager, responseProcessor);
    if (!requestHandler) throw new Error('RequestHandler is null');
});

test('RequestHandler: Has handler methods', () => {
    const config = getConfigManager();
    const cacheManager = new CacheManager(config);
    const responseProcessor = new ResponseProcessor(config);
    const requestHandler = new RequestHandler(config, cacheManager, responseProcessor);
    if (typeof requestHandler.handleRequest !== 'function') {
        throw new Error('handleRequest missing');
    }
});

// Summary
console.log('\n📊 Summary:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);

if (failed === 0) {
    console.log('\n✨ All validation tests passed!');
    console.log('   The modular architecture is properly structured.\n');
    process.exit(0);
} else {
    console.log('\n⚠️  Some validation tests failed!');
    console.log('   Please review the errors above.\n');
    process.exit(1);
}
