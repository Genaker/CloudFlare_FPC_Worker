# Quick Reference Guide

## Quick Start

### For New Users

1. **Deploy the worker:**
   ```bash
   # Use worker.js as your CloudFlare Worker script
   # Make sure to include the src/ directory
   ```

2. **Configure environment variables** (Optional):
   ```javascript
   ENV_DEBUG = "true"
   ENV_REVALIDATE_AGE = "300"
   ENV_PWA_ENABLED = "true"
   ```

3. **Set up KV and R2 bindings:**
   - KV namespace → Variable name: `KV`
   - R2 bucket → Variable name: `R2`

### For Existing Users

Keep using `FPC.js` - it works exactly as before!

Or migrate to the new structure:
- See [MIGRATION.md](MIGRATION.md) for details

## Module Overview

### ConfigManager
Manages all configuration settings.

```javascript
import { getConfigManager } from './src/config/ConfigManager.js';

const config = getConfigManager();
const debug = config.isEnabled('debug');
const age = config.get('revalidateAge', 300);
```

### CacheManager
Handles all cache operations.

```javascript
import { CacheManager } from './src/cache/CacheManager.js';

const cache = new CacheManager(config);
const version = await cache.getCurrentCacheVersion();
const response = await cache.getFromCDN(request, cacheKey);
```

### URLHandler
URL manipulation and normalization.

```javascript
import { URLHandler } from './src/utils/URLHandler.js';

const normalized = URLHandler.normalizeUrl(url);
const params = URLHandler.extractWorkerParams(url);
const key = URLHandler.generateCacheKey(request, version);
```

### CookieHandler
Cookie parsing and validation.

```javascript
import { CookieHandler } from './src/utils/CookieHandler.js';

const bypass = CookieHandler.shouldBypassCache(request, patterns);
const value = CookieHandler.getCookie(cookies, 'name');
```

### ResponseProcessor
Response modifications (ESI, PWA, speculation).

```javascript
import { ResponseProcessor } from './src/processors/ResponseProcessor.js';

const processor = new ResponseProcessor(config);
const processed = await processor.processResponse(response, context);
```

### RequestHandler
Main request orchestration.

```javascript
import { RequestHandler } from './src/RequestHandler.js';

const handler = new RequestHandler(config, cache, processor);
const response = await handler.handleRequest(request, event);
```

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| ENV_DEBUG | boolean | true | Enable debug logging |
| ENV_GOD_MOD | boolean | false | Prevent cache purges |
| ENV_REVALIDATE_AGE | int | 300 | Revalidation time (seconds) |
| ENV_HTML_CACHE_VERSION | int | null | Override cache version |
| ENV_R2_STALE | boolean | true | Enable R2 stale cache |
| ENV_R2_SERVER_RACE | boolean | true | Enable R2/server race |
| ENV_ENABLE_ESI_BLOCKS | boolean | false | Enable ESI processing |
| ENV_PWA_ENABLED | boolean | true | Enable PWA features |
| ENV_SPECULATION_ENABLED | boolean | true | Enable speculation rules |
| ENV_MOBILECACHE_DIFFERENT | boolean | false | Separate mobile cache |

## URL Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| cfw | false | Disable worker completely |
| cf-cdn | false | Bypass CDN cache |
| r2-cdn | false | Bypass R2 cache |
| cf-revalidate | true | Force revalidation |
| cf-delete | true | Delete from cache |
| cf-purge | true | Purge entire cache (increment version) |
| cf-version | N | Set specific cache version |
| cf-ttl | N | Custom TTL (for testing) |

## Common Tasks

### Check Cache Status
Add `?cf-cdn=false` to bypass CDN and check R2 cache.

### Purge Cache
Call URL with `?cf-purge=true` to increment cache version.

### Delete Single Page
Call URL with `?cf-delete=true` to remove from CDN cache.

### Force Revalidation
Call URL with `?cf-revalidate=true` to fetch fresh from origin.

### Set Specific Version
Call URL with `?cf-version=5` to set cache version to 5.

## Testing

### Run Validation
```bash
npm run validate
```

### Run Tests
```bash
export TEST_URL="https://example.com/"
npm test
```

### Run Specific Test
```bash
npm test -- --testNamePattern="Cache"
```

## File Structure

```
CloudFlare_FPC_Worker/
├── worker.js              # New modular entry point
├── FPC.js                 # Original monolithic file
├── src/
│   ├── config/
│   │   ├── constants.js
│   │   └── ConfigManager.js
│   ├── cache/
│   │   └── CacheManager.js
│   ├── utils/
│   │   ├── URLHandler.js
│   │   ├── CookieHandler.js
│   │   └── Logger.js
│   ├── processors/
│   │   └── ResponseProcessor.js
│   └── RequestHandler.js
├── ARCHITECTURE.md        # Detailed architecture docs
├── MIGRATION.md           # Migration guide
├── EXAMPLES.md            # Usage examples
└── README.md              # Main documentation
```

## Troubleshooting

### Module not found
Ensure all files in `src/` are deployed with `worker.js`.

### Environment variables not working
Check variable names have `ENV_` prefix.

### Cache not working
Verify KV namespace is bound to variable name `KV`.

### R2 not accessible
Verify R2 bucket is bound to variable name `R2`.

## Performance Tips

1. **Use CDN cache first** - It's fastest
2. **Enable R2 stale** - Serve stale while revalidating
3. **Adjust revalidate age** - Balance freshness vs. performance
4. **Use speculation rules** - Prerender next pages
5. **Enable PWA** - App-like experience

## Debug Headers

When `ENV_DEBUG=true`, responses include:

- `x-worker-time` - Worker execution time
- `x-cache-version` - Current cache version
- `x-cache-status` - Cache hit/miss status
- `x-html-edge-cache-status` - Detailed cache status

## Support

- **Documentation**: See ARCHITECTURE.md, MIGRATION.md, EXAMPLES.md
- **Issues**: https://github.com/Genaker/CloudFlare_FPC_Worker/issues
- **Email**: egorshitikov@gmail.com

## Useful Commands

```bash
# Validate structure
npm run validate

# Run tests
npm test

# Generate static pages
npm run generate

# Check syntax
node --check worker.js
node --check src/**/*.js

# Deploy with Wrangler
wrangler publish

# View logs
wrangler tail
```

## Next Steps

1. ✅ Read this quick reference
2. 📖 Read [ARCHITECTURE.md](ARCHITECTURE.md) for details
3. 🔄 Check [MIGRATION.md](MIGRATION.md) if migrating
4. 💡 Browse [EXAMPLES.md](EXAMPLES.md) for patterns
5. 🚀 Deploy and test!

## Key Differences: FPC.js vs worker.js

| Aspect | FPC.js | worker.js |
|--------|--------|-----------|
| **Structure** | Monolithic | Modular |
| **Lines** | 1,717 | 60 + modules |
| **Testing** | Hard | Easy |
| **Customization** | Edit core | Extend modules |
| **Documentation** | Comments | Full docs |
| **Learning** | Steep | Gradual |

## Version History

- **v1.0**: Original monolithic implementation
- **v2.0**: Modular architecture with improved structure

Both versions are fully supported and backward compatible!
