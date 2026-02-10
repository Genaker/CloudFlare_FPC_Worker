/**
 * Cache Manager
 * Centralized cache operations for CDN, KV, and R2 storage
 */

/**
 * CacheManager class handles all cache operations
 */
export class CacheManager {
    constructor(config) {
        this.config = config;
        this.kvNamespace = null;
        this.r2Bucket = null;
    }

    /**
     * Set KV namespace
     * @param {KVNamespace} kv - CloudFlare KV namespace
     */
    setKVNamespace(kv) {
        this.kvNamespace = kv;
    }

    /**
     * Set R2 bucket
     * @param {R2Bucket} r2 - CloudFlare R2 bucket
     */
    setR2Bucket(r2) {
        this.r2Bucket = r2;
    }

    /**
     * Get current cache version from KV
     * @returns {Promise<number>} Cache version
     */
    async getCurrentCacheVersion() {
        // Check for environment override
        const envVersion = this.config.get('htmlCacheVersion');
        if (envVersion !== false) {
            return envVersion;
        }

        if (!this.kvNamespace) {
            return 1;
        }

        try {
            const version = await this.kvNamespace.get('html_cache_version');
            if (version === null) {
                await this.kvNamespace.put('html_cache_version', '1');
                return 1;
            }
            
            let parsedVersion = parseInt(version);
            
            // Reset version if it gets too large
            if (parsedVersion > 1000) {
                parsedVersion = 1;
                await this.kvNamespace.put('html_cache_version', '1');
            }
            
            return parsedVersion;
        } catch (error) {
            console.error('Error getting cache version:', error);
            return 1;
        }
    }

    /**
     * Increment cache version (purge cache)
     * @returns {Promise<number>} New cache version
     */
    async incrementCacheVersion() {
        const currentVersion = await this.getCurrentCacheVersion();
        const newVersion = currentVersion + 1;
        
        if (this.kvNamespace) {
            await this.kvNamespace.put('html_cache_version', newVersion.toString());
        }
        
        return newVersion;
    }

    /**
     * Set specific cache version
     * @param {number} version - Version to set
     * @returns {Promise<number>} Set version
     */
    async setCacheVersion(version) {
        if (this.kvNamespace) {
            await this.kvNamespace.put('html_cache_version', version.toString());
        }
        return version;
    }

    /**
     * Get response from CDN cache
     * @param {Request} request - Request object
     * @param {string} cacheKey - Cache key URL
     * @returns {Promise<Response|null>} Cached response or null
     */
    async getFromCDN(request, cacheKey) {
        try {
            const cache = caches.default;
            const cacheRequest = new Request(cacheKey, request);
            const response = await cache.match(cacheRequest);
            return response || null;
        } catch (error) {
            console.error('Error getting from CDN cache:', error);
            return null;
        }
    }

    /**
     * Store response in CDN cache
     * @param {Request} request - Request object
     * @param {string} cacheKey - Cache key URL
     * @param {Response} response - Response to cache
     * @param {number} ttl - Time to live in seconds
     * @returns {Promise<boolean>} Success status
     */
    async storeToCDN(request, cacheKey, response, ttl = 604800) {
        try {
            const cache = caches.default;
            const cacheRequest = new Request(cacheKey, request);
            
            // Clone response and set cache headers
            const responseToCache = new Response(response.body, response);
            responseToCache.headers.set('Cache-Control', `public, max-age=${ttl}`);
            
            await cache.put(cacheRequest, responseToCache);
            return true;
        } catch (error) {
            console.error('Error storing to CDN cache:', error);
            return false;
        }
    }

    /**
     * Delete response from CDN cache
     * @param {Request} request - Request object
     * @param {string} cacheKey - Cache key URL
     * @returns {Promise<boolean>} Success status
     */
    async deleteFromCDN(request, cacheKey) {
        try {
            const cache = caches.default;
            const cacheRequest = new Request(cacheKey, request);
            const result = await cache.delete(cacheRequest);
            return result;
        } catch (error) {
            console.error('Error deleting from CDN cache:', error);
            return false;
        }
    }

    /**
     * Get response from R2 storage
     * @param {string} cacheKey - Cache key
     * @returns {Promise<object|null>} Cached data or null
     */
    async getFromR2(cacheKey) {
        if (!this.r2Bucket) {
            return null;
        }

        try {
            const r2Key = this.generateR2Key(cacheKey);
            const object = await this.r2Bucket.get(r2Key);
            
            if (!object) {
                return null;
            }

            const data = await object.text();
            return JSON.parse(data);
        } catch (error) {
            console.error('Error getting from R2:', error);
            return null;
        }
    }

    /**
     * Store response in R2 storage
     * @param {string} cacheKey - Cache key
     * @param {object} data - Data to store
     * @returns {Promise<boolean>} Success status
     */
    async storeToR2(cacheKey, data) {
        if (!this.r2Bucket) {
            return false;
        }

        try {
            const r2Key = this.generateR2Key(cacheKey);
            const jsonData = JSON.stringify(data);
            
            await this.r2Bucket.put(r2Key, jsonData, {
                httpMetadata: {
                    contentType: 'application/json'
                }
            });
            
            return true;
        } catch (error) {
            console.error('Error storing to R2:', error);
            return false;
        }
    }

    /**
     * Generate R2 key from cache key
     * @param {string} cacheKey - Cache key URL
     * @returns {string} R2 key
     */
    generateR2Key(cacheKey) {
        // Use URL hash as R2 key to avoid length issues
        const url = new URL(cacheKey);
        return `cache/${url.hostname}${url.pathname}${url.search}`.replace(/[^a-zA-Z0-9\-_\/]/g, '_');
    }

    /**
     * Check if response is cacheable
     * @param {Response} response - Response to check
     * @returns {boolean} True if cacheable
     */
    isCacheable(response) {
        // Check status code
        const cacheableStatuses = [200, 301];
        if (!cacheableStatuses.includes(response.status)) {
            return false;
        }

        // Check cache control headers
        const cacheControl = response.headers.get('Cache-Control');
        if (cacheControl) {
            if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get cache TTL from response
     * @param {Response} response - Response object
     * @returns {number} TTL in seconds
     */
    getCacheTTL(response) {
        const cacheControl = response.headers.get('Cache-Control');
        
        if (!cacheControl) {
            return 300; // Default 5 minutes
        }

        // Parse max-age or s-maxage
        const maxAgeMatch = cacheControl.match(/(?:s-maxage|max-age)=(\d+)/);
        if (maxAgeMatch) {
            return parseInt(maxAgeMatch[1]);
        }

        return 300;
    }
}
