# Migration Guide: From Monolithic to Modular Architecture

## Overview

The CloudFlare FPC Worker has been refactored to use a modular architecture. This guide helps you understand the changes and migrate to the new structure.

## What Changed?

### Before (Monolithic)
- Single `FPC.js` file (1,717 lines)
- 45+ global variables
- Mixed concerns in long functions
- Difficult to test and maintain

### After (Modular)
- 10 focused modules in `src/` directory
- Clear separation of concerns
- Testable, reusable components
- New `worker.js` entry point

## Key Benefits

1. **Better Organization**: Code is organized by functionality
2. **Easier Testing**: Each module can be tested independently
3. **Improved Maintainability**: Smaller, focused files
4. **Better Documentation**: Each module has clear responsibilities
5. **Type Safety Ready**: Structure prepared for TypeScript

## Backward Compatibility

**The original `FPC.js` file is unchanged and still works!**

You can continue using `FPC.js` as before. The new modular code is an alternative implementation that provides the same functionality with better structure.

## Migration Options

### Option 1: Keep Using FPC.js (No Changes Needed)

If you're happy with the current setup, no action is required. The original file continues to work exactly as before.

```javascript
// Your existing FPC.js deployment continues to work
// No changes needed
```

### Option 2: Switch to Modular Version (Recommended for New Projects)

For new deployments or if you want to benefit from the improved architecture:

1. Deploy `worker.js` instead of `FPC.js`
2. Ensure the `src/` directory is included in your deployment
3. All functionality remains the same

**CloudFlare Worker Configuration:**
```javascript
// Use worker.js as your main script
// The same environment variables and KV/R2 bindings work as before
```

### Option 3: Gradual Migration (For Customized Deployments)

If you've customized `FPC.js`, you can gradually adopt the new modules:

```javascript
// Import specific modules in your custom code
import { CacheManager } from './src/cache/CacheManager.js';
import { URLHandler } from './src/utils/URLHandler.js';
import { ConfigManager } from './src/config/ConfigManager.js';

// Use them in your custom logic
const config = new ConfigManager();
const cacheManager = new CacheManager(config);
```

## Module Overview

### Configuration Management
```javascript
import { getConfigManager } from './src/config/ConfigManager.js';

const config = getConfigManager();
const debugMode = config.isEnabled('debug');
const revalidateAge = config.get('revalidateAge', 300);
```

### Cache Operations
```javascript
import { CacheManager } from './src/cache/CacheManager.js';

const cacheManager = new CacheManager(config);
cacheManager.setKVNamespace(KV);

const version = await cacheManager.getCurrentCacheVersion();
const response = await cacheManager.getFromCDN(request, cacheKey);
```

### URL Handling
```javascript
import { URLHandler } from './src/utils/URLHandler.js';

const normalized = URLHandler.normalizeUrl(new URL(request.url));
const params = URLHandler.extractWorkerParams(url);
const cacheKey = URLHandler.generateCacheKey(request, version);
```

### Cookie Handling
```javascript
import { CookieHandler } from './src/utils/CookieHandler.js';

const shouldBypass = CookieHandler.shouldBypassCache(request, bypassPatterns);
const cacheVariation = CookieHandler.getCacheVariation(request, versionCookies);
```

## Environment Variables

All existing environment variables continue to work:

- `ENV_DEBUG` - Enable debug mode
- `ENV_GOD_MOD` - Enable GOD mode (cache can't be purged)
- `ENV_REVALIDATE_AGE` - Revalidation age in seconds
- `ENV_HTML_CACHE_VERSION` - Override cache version
- `ENV_R2_STALE` - Enable R2 stale cache
- `ENV_R2_SERVER_RACE` - Enable R2/server race
- `ENV_ENABLE_ESI_BLOCKS` - Enable ESI processing
- `ENV_PWA_ENABLED` - Enable PWA features
- `ENV_SPECULATION_ENABLED` - Enable speculation rules
- `ENV_CUSTOM_SPECULATION` - Custom speculation rules (JSON)
- `ENV_CUSTOM_CORS` - Custom CORS headers (JSON)
- `ENV_CLOUDFLARE_EMAIL` - CloudFlare API email
- `ENV_CLOUDFLARE_KEY` - CloudFlare API key
- `ENV_CLOUDFLARE_ZONE` - CloudFlare zone ID

## URL Parameters

All worker URL parameters continue to work:

- `?cfw=false` - Disable worker
- `?cf-cdn=false` - Bypass CDN cache
- `?r2-cdn=false` - Bypass R2 cache
- `?cf-revalidate=true` - Force revalidation
- `?cf-delete=true` - Delete from cache
- `?cf-purge=true` - Purge entire cache
- `?cf-version=N` - Set specific cache version
- `?cf-ttl=N` - Custom TTL for testing

## Testing

The new architecture is designed for better testability:

### Unit Testing Example
```javascript
import { URLHandler } from './src/utils/URLHandler.js';

describe('URLHandler', () => {
    test('normalizeUrl removes tracking parameters', () => {
        const url = new URL('https://example.com/?gclid=123&p=1');
        const normalized = URLHandler.normalizeUrl(url);
        expect(normalized.searchParams.has('gclid')).toBe(false);
        expect(normalized.searchParams.has('p')).toBe(true);
    });
});
```

### Integration Testing
The existing test suite in `fpc.test.js` continues to work for both implementations.

## Extending the Worker

### Adding Custom Cache Backend

```javascript
import { CacheManager } from './src/cache/CacheManager.js';

class CustomCacheManager extends CacheManager {
    async getFromCustom(key) {
        // Your custom cache implementation
    }
    
    async storeToCustom(key, data) {
        // Your custom cache implementation
    }
}
```

### Adding Custom Response Processor

```javascript
import { ResponseProcessor } from './src/processors/ResponseProcessor.js';

class CustomProcessor extends ResponseProcessor {
    async processCustom(response, context) {
        // Your custom processing
        return modifiedResponse;
    }
}
```

### Adding Custom URL Handler

```javascript
import { URLHandler } from './src/utils/URLHandler.js';

class CustomURLHandler extends URLHandler {
    static customNormalization(url) {
        // Your custom URL logic
        return normalizedUrl;
    }
}
```

## Performance Considerations

The modular architecture has **no performance impact**:

- CloudFlare bundles ES modules efficiently
- No runtime overhead from imports
- Same caching behavior as original
- Potentially better optimization opportunities

## Troubleshooting

### Issue: Worker doesn't start

**Solution**: Ensure all files in `src/` directory are deployed with `worker.js`

### Issue: Environment variables not working

**Solution**: Check that variable names have `ENV_` prefix (e.g., `ENV_DEBUG` not `DEBUG`)

### Issue: Import errors

**Solution**: Verify file paths are correct and use `.js` extensions in imports

### Issue: KV or R2 not accessible

**Solution**: Ensure bindings are configured in Worker settings:
- KV namespace bound to variable name `KV`
- R2 bucket bound to variable name `R2`

## Getting Help

- **Architecture Documentation**: See `ARCHITECTURE.md` for detailed module documentation
- **Original Documentation**: See `README.md` for feature documentation
- **Issues**: Report issues on GitHub
- **Email**: egorshitikov@gmail.com

## Comparison: FPC.js vs worker.js

| Aspect | FPC.js | worker.js |
|--------|---------|-----------|
| **File Size** | 1,717 lines | 60 lines + modules |
| **Organization** | Single file | 10 modules |
| **Testability** | Difficult | Easy |
| **Maintainability** | Hard to navigate | Clear structure |
| **Extensibility** | Requires editing core | Plugin-friendly |
| **Learning Curve** | Steep | Gradual |
| **Documentation** | Comments | Full API docs |
| **Type Safety** | No | Ready for TypeScript |
| **Performance** | Fast | Same |
| **Features** | All | All |

## Next Steps

1. **Read ARCHITECTURE.md** for detailed module documentation
2. **Review your use case**:
   - Using as-is? Keep `FPC.js`
   - New deployment? Use `worker.js`
   - Customized? Gradual migration
3. **Test in development** environment first
4. **Deploy to production** when ready

## Future Roadmap

- [ ] TypeScript conversion
- [ ] Enhanced monitoring and metrics
- [ ] Plugin system for custom processors
- [ ] Visual debug dashboard
- [ ] Advanced caching strategies
- [ ] GraphQL API caching support

## Feedback

We welcome feedback on the new architecture! Please:
- Open issues for bugs or suggestions
- Submit PRs for improvements
- Share your use cases

The goal is to make the CloudFlare FPC Worker more maintainable and extensible while preserving all existing functionality.
