# Architecture Documentation

## Overview

The CloudFlare FPC Worker has been refactored to follow modern software architecture principles with clear separation of concerns, modularity, and maintainability.

## Architecture Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Modularity**: Code is organized into reusable, testable modules
3. **Dependency Injection**: Components receive their dependencies explicitly
4. **Immutability**: Minimize state mutation where possible
5. **Single Responsibility**: Each class/function does one thing well

## Directory Structure

```
src/
├── config/
│   ├── constants.js         # Application constants and static configuration
│   └── ConfigManager.js     # Dynamic configuration management
├── cache/
│   └── CacheManager.js      # Cache operations (CDN, KV, R2)
├── utils/
│   ├── URLHandler.js        # URL parsing and normalization
│   ├── CookieHandler.js     # Cookie parsing and validation
│   └── Logger.js            # Structured logging
├── processors/
│   └── ResponseProcessor.js # Response modifications (ESI, PWA, speculation)
└── RequestHandler.js        # Main request orchestration

worker.js                     # Worker entry point (uses modular code)
FPC.js                       # Original monolithic implementation (kept for reference)
```

## Module Responsibilities

### ConfigManager (`src/config/ConfigManager.js`)

**Purpose**: Centralized configuration management

**Responsibilities**:
- Load configuration from environment variables
- Support KV-based configuration (future)
- Provide type-safe config access
- Handle configuration defaults

**Key Methods**:
- `initialize()` - Load configuration
- `get(key, default)` - Get config value
- `isEnabled(feature)` - Check feature flag
- `getConfigValue(name, default, type)` - Get typed config

**Usage**:
```javascript
import { getConfigManager } from './src/config/ConfigManager.js';

const config = getConfigManager();
const debugEnabled = config.isEnabled('debug');
const revalidateAge = config.get('revalidateAge', 300);
```

### CacheManager (`src/cache/CacheManager.js`)

**Purpose**: Abstraction layer for all cache operations

**Responsibilities**:
- Manage cache version
- CDN cache operations (get, store, delete)
- R2 storage operations (get, store)
- KV storage operations
- Cache validation logic

**Key Methods**:
- `getCurrentCacheVersion()` - Get current cache version
- `incrementCacheVersion()` - Purge cache by incrementing version
- `getFromCDN(request, cacheKey)` - Retrieve from CDN cache
- `storeToCDN(request, cacheKey, response, ttl)` - Store to CDN
- `getFromR2(cacheKey)` - Retrieve from R2 storage
- `storeToR2(cacheKey, data)` - Store to R2
- `isCacheable(response)` - Check if response can be cached
- `getCacheTTL(response)` - Extract TTL from response

**Usage**:
```javascript
const cacheManager = new CacheManager(config);
cacheManager.setKVNamespace(KV);
cacheManager.setR2Bucket(R2);

const version = await cacheManager.getCurrentCacheVersion();
const response = await cacheManager.getFromCDN(request, cacheKey);
```

### URLHandler (`src/utils/URLHandler.js`)

**Purpose**: URL manipulation and normalization

**Responsibilities**:
- Normalize URLs (filter tracking params, sort query string)
- Extract worker-specific parameters
- Generate cache keys
- Check URL bypass patterns
- Mobile device detection

**Key Methods**:
- `normalizeUrl(url, allowedGetOnly)` - Normalize URL
- `extractWorkerParams(url)` - Parse worker parameters
- `generateCacheKey(request, version, mobile)` - Create cache key
- `shouldBypassURL(request, patterns)` - Check bypass rules
- `shouldAlwaysCache(url, patterns)` - Check always-cache rules
- `isMobileDevice(request)` - Detect mobile

**Usage**:
```javascript
import { URLHandler } from './src/utils/URLHandler.js';

const normalized = URLHandler.normalizeUrl(new URL(request.url));
const params = URLHandler.extractWorkerParams(url);
const cacheKey = URLHandler.generateCacheKey(request, version);
```

### CookieHandler (`src/utils/CookieHandler.js`)

**Purpose**: Cookie parsing and validation

**Responsibilities**:
- Parse cookie headers
- Check bypass cookies
- Extract cache variation from cookies
- Cookie-based routing logic

**Key Methods**:
- `shouldBypassCache(request, patterns)` - Check if cookies require bypass
- `checkCookies(header, patterns)` - Validate cookies against patterns
- `getCookie(cookies, name)` - Extract specific cookie
- `getCacheVariation(request, versionCookies)` - Get cache variation

**Usage**:
```javascript
import { CookieHandler } from './src/utils/CookieHandler.js';

const bypass = CookieHandler.shouldBypassCache(request, bypassPatterns);
const vary = CookieHandler.getCacheVariation(request, versionCookies);
```

### ResponseProcessor (`src/processors/ResponseProcessor.js`)

**Purpose**: Response modification and enhancement

**Responsibilities**:
- Process ESI (Edge Side Includes) blocks
- Inject PWA manifest
- Add speculation rules
- Modify response headers
- Validate response size

**Key Methods**:
- `processResponse(response, context)` - Apply all processors
- `processESI(response, context)` - Handle ESI tags
- `processManifest(response, context)` - Inject PWA manifest
- `processSpeculation(response, context)` - Add speculation rules
- `addHeaders(response, headers)` - Add custom headers
- `checkBodySize(response, limit)` - Validate size

**Usage**:
```javascript
const processor = new ResponseProcessor(config);
const processed = await processor.processResponse(response, context);
```

### RequestHandler (`src/RequestHandler.js`)

**Purpose**: Main request orchestration

**Responsibilities**:
- Create request context
- Check bypass conditions
- Handle special actions (purge, delete, version)
- Coordinate cache lookup
- Fetch from origin
- Cache responses
- Add debug information

**Key Methods**:
- `handleRequest(request, event)` - Main entry point
- `createContext(request, event)` - Build request context
- `shouldBypassWorker(request, context)` - Check bypass
- `handleSpecialActions(request, context)` - Handle admin actions
- `getCachedResponse(request, context)` - Try cache
- `fetchFromOrigin(request)` - Get from backend
- `cacheResponse(request, response, context)` - Store response

**Usage**:
```javascript
const handler = new RequestHandler(config, cacheManager, processor);
const response = await handler.handleRequest(request, event);
```

### Logger (`src/utils/Logger.js`)

**Purpose**: Structured logging

**Responsibilities**:
- Log messages with levels (ERROR, WARN, INFO, DEBUG)
- Timing information
- Conditional logging based on config

**Key Methods**:
- `error(message, data)` - Log error
- `warn(message, data)` - Log warning
- `info(message, data)` - Log info
- `debug(message, data)` - Log debug
- `timing(label, start, end)` - Log timing

**Usage**:
```javascript
import { createLogger } from './src/utils/Logger.js';

const logger = createLogger(config);
logger.debug('Request received');
logger.timing('Cache lookup', startTime, endTime);
```

## Request Flow

1. **Worker Entry Point** (`worker.js`)
   - Receives fetch event
   - Initializes components (if not already done)
   - Delegates to RequestHandler

2. **Request Handler** (`RequestHandler.js`)
   - Creates request context
   - Checks bypass conditions (cookies, URLs, parameters)
   - Handles special actions (purge, delete, version set)
   - Attempts cache lookup (CDN → R2)
   - Falls back to origin fetch if needed
   - Caches response asynchronously
   - Adds debug headers

3. **Cache Manager** (`CacheManager.js`)
   - Manages cache version
   - Handles CDN cache operations
   - Handles R2 storage operations
   - Validates cacheability

4. **Response Processor** (`ResponseProcessor.js`)
   - Processes ESI blocks
   - Injects PWA manifest
   - Adds speculation rules
   - Modifies headers

## Benefits of New Architecture

### 1. Maintainability
- **Before**: 1,717 lines in single file
- **After**: ~10 focused modules, largest is 400 lines
- Easy to locate and modify specific functionality

### 2. Testability
- Each module can be tested independently
- Mock dependencies easily
- Unit tests for individual components
- Integration tests for RequestHandler

### 3. Reusability
- Modules can be reused in other workers
- Clear interfaces for each component
- No hidden dependencies

### 4. Extensibility
- Add new cache backends by extending CacheManager
- Add new processors without modifying existing code
- Plugin architecture for custom functionality

### 5. Type Safety (Future)
- Structure is ready for TypeScript conversion
- Clear interfaces between modules
- Type annotations can be added incrementally

### 6. Performance
- No performance impact from modularization
- CloudFlare bundles ES modules efficiently
- Clear separation allows targeted optimization

## Migration Guide

### For Users

The original `FPC.js` file remains unchanged and functional. To use the new modular version:

1. **Option 1: Use new worker.js**
   ```javascript
   // Deploy worker.js instead of FPC.js
   // All functionality is preserved
   ```

2. **Option 2: Gradual migration**
   ```javascript
   // Import specific modules in existing code
   import { CacheManager } from './src/cache/CacheManager.js';
   ```

### For Developers

**Adding a new cache backend:**

```javascript
// Extend CacheManager
class CustomCacheManager extends CacheManager {
    async getFromCustomBackend(key) {
        // Implementation
    }
    
    async storeToCustomBackend(key, data) {
        // Implementation
    }
}
```

**Adding a new response processor:**

```javascript
// Add to ResponseProcessor
async processCustom(response, context) {
    // Custom processing logic
    return processedResponse;
}

// Use in processResponse method
if (this.config.isEnabled('customProcessor')) {
    processedResponse = await this.processCustom(processedResponse, context);
}
```

**Adding a new utility:**

```javascript
// Create new utility in src/utils/
export class CustomHandler {
    static process(input) {
        // Implementation
    }
}
```

## Testing Strategy

### Unit Tests
- Test each module independently
- Mock dependencies
- Test edge cases and error handling

### Integration Tests
- Test RequestHandler with real components
- Test cache flow end-to-end
- Test special actions (purge, delete, etc.)

### Performance Tests
- Measure response time
- Test cache hit rates
- Monitor memory usage

## Future Improvements

1. **TypeScript Conversion**
   - Add type definitions
   - Improve IDE support
   - Catch errors at compile time

2. **Enhanced Monitoring**
   - Structured logging to external service
   - Metrics collection
   - Performance tracing

3. **Plugin System**
   - Allow custom processors
   - Allow custom cache backends
   - Configuration via plugins

4. **Advanced Caching**
   - Stale-while-revalidate improvements
   - Edge-side rendering
   - Partial page caching

5. **Developer Tools**
   - Local testing environment
   - Debug dashboard
   - Cache visualization

## Conclusion

The new architecture provides a solid foundation for future development while maintaining full backward compatibility. The modular structure makes the codebase easier to understand, test, and extend.
