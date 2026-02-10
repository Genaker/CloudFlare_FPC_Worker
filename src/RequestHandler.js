/**
 * Request Handler
 * Main request processing orchestration
 */

import { URLHandler } from './utils/URLHandler.js';
import { CookieHandler } from './utils/CookieHandler.js';
import { CacheManager } from './cache/CacheManager.js';
import { ResponseProcessor } from './processors/ResponseProcessor.js';
import { createLogger } from './utils/Logger.js';
import {
    DEFAULT_BYPASS_COOKIES,
    BYPASS_URL,
    CACHE_ALWAYS,
    CACHE_STATUSES
} from './config/constants.js';

/**
 * RequestHandler class for processing requests
 */
export class RequestHandler {
    constructor(config, cacheManager, responseProcessor) {
        this.config = config;
        this.cacheManager = cacheManager;
        this.responseProcessor = responseProcessor;
        this.logger = createLogger(config);
    }

    /**
     * Process incoming request
     * @param {Request} request - Original request
     * @param {object} event - Fetch event
     * @returns {Promise<Response>} Response
     */
    async handleRequest(request, event) {
        const startTime = Date.now();
        
        try {
            // Create request context
            const context = this.createContext(request, event);

            // Check if worker should be bypassed
            if (this.shouldBypassWorker(request, context)) {
                this.logger.debug('Bypassing worker');
                return this.fetchFromOrigin(request);
            }

            // Handle special actions (purge, delete, version set)
            const specialResponse = await this.handleSpecialActions(request, context);
            if (specialResponse) {
                return specialResponse;
            }

            // Try to get cached response
            const cachedResponse = await this.getCachedResponse(request, context);
            
            if (cachedResponse) {
                this.logger.debug('Returning cached response');
                const endTime = Date.now();
                return this.addDebugHeaders(cachedResponse, context, startTime, endTime);
            }

            // Check speculation rules
            if (context.speculation && this.config.isEnabled('speculationCachedOnly')) {
                return new Response("Speculation only from cache", {
                    headers: { "Cache-Control": "no-store,private" },
                    status: 406
                });
            }

            // Fetch from origin
            this.logger.debug('Fetching from origin');
            const response = await this.fetchFromOrigin(request);

            // Process and cache response
            if (this.cacheManager.isCacheable(response)) {
                event.waitUntil(this.cacheResponse(request, response.clone(), context));
            }

            const endTime = Date.now();
            return this.addDebugHeaders(response, context, startTime, endTime);

        } catch (error) {
            this.logger.error('Error handling request:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    }

    /**
     * Create request context
     * @param {Request} request - Request object
     * @param {object} event - Fetch event
     * @returns {object} Request context
     */
    createContext(request, event) {
        const url = new URL(request.url);
        const workerParams = URLHandler.extractWorkerParams(url);
        
        return {
            event,
            url: url.toString(),
            workerParams,
            cookies: request.headers.get('cookie') || '',
            bypassCache: false,
            bypassUrl: false,
            bypassCookies: false,
            speculation: request.headers.get('Sec-Purpose') === 'prerender',
            country: request.cf?.country || '',
            cacheVersion: null,
            status: []
        };
    }

    /**
     * Check if worker should be bypassed
     * @param {Request} request - Request object
     * @param {object} context - Request context
     * @returns {boolean} True if should bypass
     */
    shouldBypassWorker(request, context) {
        // Check worker disable parameter
        if (context.workerParams.disableWorker) {
            return true;
        }

        // Check bypass cookies
        const bypassCookies = CookieHandler.shouldBypassCache(
            request,
            DEFAULT_BYPASS_COOKIES
        );
        
        if (bypassCookies) {
            context.bypassCookies = true;
            return true;
        }

        // Check bypass URL patterns
        const bypassUrl = URLHandler.shouldBypassURL(request, BYPASS_URL);
        
        if (bypassUrl) {
            context.bypassUrl = true;
            return true;
        }

        return false;
    }

    /**
     * Handle special actions (purge, delete, version set)
     * @param {Request} request - Request object
     * @param {object} context - Request context
     * @returns {Promise<Response|null>} Response or null
     */
    async handleSpecialActions(request, context) {
        const { workerParams } = context;

        // Handle cache purge
        if (workerParams.purge) {
            if (this.config.isEnabled('godMod')) {
                return new Response("GOD MODE: Cache NOT Purged", {
                    headers: { 'cache-version': 'GODMOD' },
                    status: 222
                });
            }

            const newVersion = await this.cacheManager.incrementCacheVersion();
            return new Response(`Cache Purged (NEW VERSION: ${newVersion})`, {
                headers: { 'cache-version': newVersion.toString() },
                status: 222
            });
        }

        // Handle version set
        if (workerParams.setVersion) {
            const version = parseInt(workerParams.setVersion);
            
            if (isNaN(version)) {
                return new Response("Invalid version number", { status: 400 });
            }

            await this.cacheManager.setCacheVersion(version);
            return new Response(`Version set to ${version}`, {
                headers: { 'cache-version': version.toString() },
                status: 223
            });
        }

        // Handle cache delete
        if (workerParams.delete) {
            const cacheVersion = await this.cacheManager.getCurrentCacheVersion();
            const cacheKey = URLHandler.generateCacheKey(
                request,
                cacheVersion,
                this.config.get('mobileCacheDifferent')
            );
            
            const deleted = await this.cacheManager.deleteFromCDN(request, cacheKey);
            
            return new Response("Cache entry deleted", {
                headers: {
                    'deleted': 'true',
                    'delete-status': deleted.toString()
                },
                status: 211
            });
        }

        return null;
    }

    /**
     * Get cached response
     * @param {Request} request - Request object
     * @param {object} context - Request context
     * @returns {Promise<Response|null>} Cached response or null
     */
    async getCachedResponse(request, context) {
        const { workerParams } = context;

        // Get cache version
        const cacheVersion = await this.cacheManager.getCurrentCacheVersion();
        context.cacheVersion = cacheVersion;

        // Generate cache key
        const cacheKey = URLHandler.generateCacheKey(
            request,
            cacheVersion,
            this.config.get('mobileCacheDifferent')
        );

        // Check if should bypass CDN cache
        if (workerParams.bypassCDN) {
            return await this.getFromR2(cacheKey, context);
        }

        // Try CDN cache first
        const cdnResponse = await this.cacheManager.getFromCDN(request, cacheKey);
        
        if (cdnResponse) {
            context.status.push('CDN_HIT');
            return cdnResponse;
        }

        // Try R2 cache
        return await this.getFromR2(cacheKey, context);
    }

    /**
     * Get response from R2 storage
     * @param {string} cacheKey - Cache key
     * @param {object} context - Request context
     * @returns {Promise<Response|null>} Response or null
     */
    async getFromR2(cacheKey, context) {
        const r2Data = await this.cacheManager.getFromR2(cacheKey);
        
        if (!r2Data) {
            return null;
        }

        context.status.push('R2_HIT');

        // Reconstruct response from R2 data
        return new Response(r2Data.body, {
            status: r2Data.status,
            statusText: r2Data.statusText,
            headers: r2Data.headers
        });
    }

    /**
     * Fetch response from origin
     * @param {Request} request - Request object
     * @returns {Promise<Response>} Response from origin
     */
    async fetchFromOrigin(request) {
        const modifiedRequest = new Request(request, {
            headers: {
                ...Object.fromEntries(request.headers.entries()),
                "Accept-Encoding": "br, gzip",
                "x-HTML-Edge-Cache": "supports=cache|purgeall|bypass-cookies"
            }
        });

        return fetch(modifiedRequest);
    }

    /**
     * Cache response
     * @param {Request} request - Request object
     * @param {Response} response - Response to cache
     * @param {object} context - Request context
     * @returns {Promise<void>}
     */
    async cacheResponse(request, response, context) {
        try {
            const { cacheVersion } = context;
            
            // Generate cache key
            const cacheKey = URLHandler.generateCacheKey(
                request,
                cacheVersion,
                this.config.get('mobileCacheDifferent')
            );

            // Process response (ESI, PWA, speculation)
            const processedResponse = await this.responseProcessor.processResponse(
                response.clone(),
                context
            );

            // Get TTL
            const ttl = this.cacheManager.getCacheTTL(processedResponse);

            // Store in CDN cache
            await this.cacheManager.storeToCDN(
                request,
                cacheKey,
                processedResponse.clone(),
                ttl
            );

            // Store in R2 if available
            if (this.cacheManager.r2Bucket) {
                const r2Data = {
                    body: await processedResponse.text(),
                    status: processedResponse.status,
                    statusText: processedResponse.statusText,
                    headers: Object.fromEntries(processedResponse.headers.entries())
                };
                
                await this.cacheManager.storeToR2(cacheKey, r2Data);
            }

        } catch (error) {
            this.logger.error('Error caching response:', error);
        }
    }

    /**
     * Add debug headers to response
     * @param {Response} response - Response object
     * @param {object} context - Request context
     * @param {number} startTime - Start time
     * @param {number} endTime - End time
     * @returns {Response} Response with debug headers
     */
    addDebugHeaders(response, context, startTime, endTime) {
        if (!this.config.isEnabled('debug')) {
            return response;
        }

        const headers = {
            'x-worker-time': `${endTime - startTime}ms`,
            'x-cache-version': context.cacheVersion?.toString() || 'unknown',
            'x-cache-status': context.status.join(',') || 'MISS'
        };

        return this.responseProcessor.addHeaders(response, headers);
    }
}
