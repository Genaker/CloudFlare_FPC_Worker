# Examples - CloudFlare FPC Worker

This document provides practical examples of using the modular CloudFlare FPC Worker.

## Basic Usage

### Using the Modular Worker (worker.js)

Deploy `worker.js` as your CloudFlare Worker script. It automatically initializes all components.

```javascript
// worker.js is the entry point - no code changes needed
// All configuration is via environment variables
```

## Custom Implementations

### Example 1: Custom Cache Key Generation

Create a custom cache key based on user preferences:

```javascript
import { URLHandler } from './src/utils/URLHandler.js';
import { CookieHandler } from './src/utils/CookieHandler.js';

class CustomURLHandler extends URLHandler {
    static generateCacheKey(request, cacheVersion, mobileCacheDifferent = false) {
        const url = new URL(request.url);
        const normalizedUrl = this.normalizeUrl(url);
        
        // Add cache version
        normalizedUrl.searchParams.set('cf_edge_cache_ver', cacheVersion.toString());
        
        // Add custom user preferences from cookie
        const userPrefs = CookieHandler.getCookie(
            request.headers.get('cookie'),
            'user_prefs'
        );
        
        if (userPrefs) {
            normalizedUrl.searchParams.set('cf_user_prefs', userPrefs);
        }
        
        return normalizedUrl.toString();
    }
}

// Use in your worker
export { CustomURLHandler as URLHandler };
```

### Example 2: Custom Response Processor

Add custom headers or modify content:

```javascript
import { ResponseProcessor } from './src/processors/ResponseProcessor.js';

class CustomResponseProcessor extends ResponseProcessor {
    async processResponse(response, context) {
        // First, apply standard processing
        let processed = await super.processResponse(response, context);
        
        // Add custom security headers
        processed = this.addSecurityHeaders(processed);
        
        // Add custom analytics
        processed = await this.addAnalytics(processed, context);
        
        return processed;
    }
    
    addSecurityHeaders(response) {
        const headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        };
        
        return this.addHeaders(response, headers);
    }
    
    async addAnalytics(response, context) {
        const contentType = response.headers.get('Content-Type') || '';
        
        if (!contentType.includes('text/html')) {
            return response;
        }
        
        let html = await response.text();
        
        // Inject analytics code before </body>
        const analyticsCode = `
            <script>
                // Custom analytics
                console.log('Page served from edge:', '${context.country}');
            </script>
        `;
        
        html = html.replace('</body>', `${analyticsCode}\n</body>`);
        
        return new Response(html, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    }
}

// Use in your worker initialization
const responseProcessor = new CustomResponseProcessor(config);
```

### Example 3: Geographic-Based Caching

Different cache based on user location:

```javascript
import { RequestHandler } from './src/RequestHandler.js';

class GeoRequestHandler extends RequestHandler {
    createContext(request, event) {
        const context = super.createContext(request, event);
        
        // Add geographic segmentation
        const country = request.cf?.country || 'UNKNOWN';
        context.geoSegment = this.getGeoSegment(country);
        
        return context;
    }
    
    getGeoSegment(country) {
        // Group countries into regions
        const regions = {
            'NA': ['US', 'CA', 'MX'],
            'EU': ['GB', 'DE', 'FR', 'IT', 'ES'],
            'AS': ['CN', 'JP', 'KR', 'IN'],
            'SA': ['BR', 'AR', 'CL'],
            'OC': ['AU', 'NZ']
        };
        
        for (const [region, countries] of Object.entries(regions)) {
            if (countries.includes(country)) {
                return region;
            }
        }
        
        return 'OTHER';
    }
    
    async getCachedResponse(request, context) {
        // Modify cache key to include geo segment
        const { workerParams } = context;
        const cacheVersion = await this.cacheManager.getCurrentCacheVersion();
        context.cacheVersion = cacheVersion;
        
        // Generate geo-specific cache key
        const url = new URL(request.url);
        url.searchParams.set('cf_geo', context.geoSegment);
        url.searchParams.set('cf_edge_cache_ver', cacheVersion.toString());
        
        const cacheKey = url.toString();
        
        // Try CDN cache
        if (!workerParams.bypassCDN) {
            const cdnResponse = await this.cacheManager.getFromCDN(request, cacheKey);
            if (cdnResponse) {
                context.status.push('CDN_HIT', 'GEO_' + context.geoSegment);
                return cdnResponse;
            }
        }
        
        return null;
    }
}
```

### Example 4: A/B Testing Integration

Implement A/B testing with cached variants:

```javascript
import { CookieHandler } from './src/utils/CookieHandler.js';

class ABTestHandler {
    static getVariant(request) {
        // Check if user already has a variant
        const existingVariant = CookieHandler.getCookie(
            request.headers.get('cookie'),
            'ab_variant'
        );
        
        if (existingVariant) {
            return existingVariant;
        }
        
        // Assign new variant (50/50 split)
        return Math.random() < 0.5 ? 'A' : 'B';
    }
    
    static generateCacheKeyWithVariant(request, cacheVersion) {
        const url = new URL(request.url);
        const variant = this.getVariant(request);
        
        url.searchParams.set('cf_ab_variant', variant);
        url.searchParams.set('cf_edge_cache_ver', cacheVersion.toString());
        
        return url.toString();
    }
    
    static addVariantCookie(response, variant) {
        const newResponse = new Response(response.body, response);
        
        // Set cookie for 30 days
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        newResponse.headers.append(
            'Set-Cookie',
            `ab_variant=${variant}; Expires=${expires.toUTCString()}; Path=/; Secure; HttpOnly`
        );
        
        return newResponse;
    }
}

// Usage in custom RequestHandler
class ABTestRequestHandler extends RequestHandler {
    async getCachedResponse(request, context) {
        const cacheVersion = await this.cacheManager.getCurrentCacheVersion();
        const cacheKey = ABTestHandler.generateCacheKeyWithVariant(request, cacheVersion);
        
        return await this.cacheManager.getFromCDN(request, cacheKey);
    }
    
    addDebugHeaders(response, context, startTime, endTime) {
        response = super.addDebugHeaders(response, context, startTime, endTime);
        
        const variant = ABTestHandler.getVariant(context.event.request);
        response = ABTestHandler.addVariantCookie(response, variant);
        
        return response;
    }
}
```

### Example 5: Custom Logging to External Service

Send logs to an external logging service:

```javascript
import { Logger } from './src/utils/Logger.js';

class ExternalLogger extends Logger {
    constructor(config, logEndpoint) {
        super(config);
        this.logEndpoint = logEndpoint;
        this.logBuffer = [];
    }
    
    async log(level, message, data) {
        // Standard console logging
        super[level](message, data);
        
        // Buffer for external logging
        this.logBuffer.push({
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        });
        
        // Flush buffer if it gets large
        if (this.logBuffer.length >= 10) {
            await this.flush();
        }
    }
    
    async flush() {
        if (this.logBuffer.length === 0) {
            return;
        }
        
        try {
            await fetch(this.logEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.logBuffer)
            });
            
            this.logBuffer = [];
        } catch (error) {
            console.error('Failed to send logs:', error);
        }
    }
    
    error(message, data = null) {
        this.log('error', message, data);
    }
    
    info(message, data = null) {
        this.log('info', message, data);
    }
    
    debug(message, data = null) {
        this.log('debug', message, data);
    }
}

// Use in worker initialization
const logger = new ExternalLogger(config, 'https://logs.example.com/api/ingest');
```

### Example 6: Rate Limiting by IP

Implement simple rate limiting:

```javascript
class RateLimiter {
    constructor(maxRequests = 100, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
    }
    
    isAllowed(ip) {
        const now = Date.now();
        const userRequests = this.requests.get(ip) || [];
        
        // Remove old requests outside the window
        const recentRequests = userRequests.filter(
            time => now - time < this.windowMs
        );
        
        if (recentRequests.length >= this.maxRequests) {
            return false;
        }
        
        recentRequests.push(now);
        this.requests.set(ip, recentRequests);
        
        // Cleanup old entries periodically
        if (this.requests.size > 10000) {
            this.cleanup(now);
        }
        
        return true;
    }
    
    cleanup(now) {
        for (const [ip, requests] of this.requests.entries()) {
            const recent = requests.filter(time => now - time < this.windowMs);
            if (recent.length === 0) {
                this.requests.delete(ip);
            } else {
                this.requests.set(ip, recent);
            }
        }
    }
}

// Use in RequestHandler
class RateLimitedRequestHandler extends RequestHandler {
    constructor(config, cacheManager, responseProcessor) {
        super(config, cacheManager, responseProcessor);
        this.rateLimiter = new RateLimiter(100, 60000); // 100 req/min
    }
    
    async handleRequest(request, event) {
        const ip = request.headers.get('CF-Connecting-IP');
        
        if (!this.rateLimiter.isAllowed(ip)) {
            return new Response('Too Many Requests', {
                status: 429,
                headers: {
                    'Retry-After': '60'
                }
            });
        }
        
        return super.handleRequest(request, event);
    }
}
```

### Example 7: GraphQL Query Caching

Cache GraphQL queries based on query hash:

```javascript
import { createHash } from 'crypto';

class GraphQLCacheHandler {
    static async handleGraphQL(request, cacheManager, config) {
        if (request.method !== 'POST') {
            return null;
        }
        
        const contentType = request.headers.get('Content-Type') || '';
        if (!contentType.includes('application/json')) {
            return null;
        }
        
        try {
            const body = await request.clone().json();
            
            if (!body.query) {
                return null;
            }
            
            // Generate hash of query + variables
            const queryHash = await this.hashQuery(body.query, body.variables);
            const cacheKey = `gql:${queryHash}`;
            
            // Try cache
            const cached = await cacheManager.getFromR2(cacheKey);
            if (cached) {
                return new Response(JSON.stringify(cached.data), {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Cache': 'HIT',
                        'X-Cache-Key': cacheKey
                    }
                });
            }
            
            return null;
        } catch (error) {
            console.error('GraphQL cache error:', error);
            return null;
        }
    }
    
    static async hashQuery(query, variables) {
        const data = JSON.stringify({ query, variables });
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    static async cacheGraphQLResponse(request, response, cacheManager) {
        try {
            const body = await request.clone().json();
            const responseData = await response.clone().json();
            
            const queryHash = await this.hashQuery(body.query, body.variables);
            const cacheKey = `gql:${queryHash}`;
            
            await cacheManager.storeToR2(cacheKey, {
                data: responseData,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('GraphQL cache store error:', error);
        }
    }
}
```

## Testing Examples

### Unit Test Example

```javascript
import { URLHandler } from './src/utils/URLHandler.js';

describe('URLHandler', () => {
    describe('normalizeUrl', () => {
        test('removes tracking parameters', () => {
            const url = new URL('https://example.com/?gclid=abc&p=1');
            const normalized = URLHandler.normalizeUrl(url);
            
            expect(normalized.searchParams.has('gclid')).toBe(false);
            expect(normalized.searchParams.has('p')).toBe(true);
        });
        
        test('sorts query parameters', () => {
            const url = new URL('https://example.com/?z=1&a=2&m=3');
            const normalized = URLHandler.normalizeUrl(url);
            
            expect(normalized.search).toBe('?a=2&m=3&z=1');
        });
    });
    
    describe('extractWorkerParams', () => {
        test('extracts worker parameters', () => {
            const url = new URL('https://example.com/?cf-cdn=false&p=1');
            const params = URLHandler.extractWorkerParams(url);
            
            expect(params.bypassCDN).toBe(true);
            expect(params.disableWorker).toBe(false);
        });
    });
});
```

### Integration Test Example

```javascript
import { RequestHandler } from './src/RequestHandler.js';
import { CacheManager } from './src/cache/CacheManager.js';
import { ResponseProcessor } from './src/processors/ResponseProcessor.js';
import { getConfigManager } from './src/config/ConfigManager.js';

describe('RequestHandler Integration', () => {
    let handler;
    
    beforeEach(() => {
        const config = getConfigManager();
        const cacheManager = new CacheManager(config);
        const responseProcessor = new ResponseProcessor(config);
        handler = new RequestHandler(config, cacheManager, responseProcessor);
    });
    
    test('handles cache miss and fetch from origin', async () => {
        const request = new Request('https://example.com/test');
        const event = {
            request,
            waitUntil: jest.fn()
        };
        
        global.fetch = jest.fn().mockResolvedValue(
            new Response('Hello World', { status: 200 })
        );
        
        const response = await handler.handleRequest(request, event);
        
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('Hello World');
        expect(global.fetch).toHaveBeenCalled();
    });
});
```

## Deployment Examples

### Wrangler Configuration

```toml
# wrangler.toml
name = "fpc-worker"
main = "worker.js"
compatibility_date = "2024-01-01"

[env.production]
kv_namespaces = [
    { binding = "KV", id = "your-kv-namespace-id" }
]

r2_buckets = [
    { binding = "R2", bucket_name = "your-r2-bucket" }
]

[env.production.vars]
ENV_DEBUG = "false"
ENV_REVALIDATE_AGE = "300"
ENV_PWA_ENABLED = "true"
ENV_SPECULATION_ENABLED = "true"
```

### Deploy Command

```bash
# Deploy to production
wrangler publish --env production

# Deploy with specific version
wrangler publish --env production --compatibility-date 2024-01-01
```

These examples demonstrate the flexibility and extensibility of the modular architecture. You can mix and match these patterns to create a custom solution that fits your specific needs.
