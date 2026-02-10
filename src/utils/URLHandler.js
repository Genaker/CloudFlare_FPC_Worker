/**
 * URL Utilities
 * Functions for URL normalization, parameter filtering, and cache key generation
 */

import { FILTER_GET, ALLOWED_GET } from '../config/constants.js';

/**
 * URL Handler class for managing URL operations
 */
export class URLHandler {
    /**
     * Normalize URL by filtering and sorting query parameters
     * @param {URL} url - URL object to normalize
     * @param {boolean} allowedGetOnly - Only allow whitelisted GET parameters
     * @returns {URL} Normalized URL
     */
    static normalizeUrl(url, allowedGetOnly = false) {
        const normalizedUrl = new URL(url);
        const params = new URLSearchParams(normalizedUrl.search);
        const filteredParams = new URLSearchParams();

        // Sort and filter parameters
        const sortedParams = Array.from(params.entries()).sort((a, b) => 
            a[0].localeCompare(b[0])
        );

        for (const [key, value] of sortedParams) {
            const shouldFilter = FILTER_GET.includes(key);
            const shouldAllow = !allowedGetOnly || ALLOWED_GET.includes(key);

            if (!shouldFilter && shouldAllow) {
                filteredParams.append(key, value);
            }
        }

        normalizedUrl.search = filteredParams.toString();
        return normalizedUrl;
    }

    /**
     * Extract worker-specific parameters from URL
     * @param {URL} url - URL to parse
     * @returns {object} Worker parameters
     */
    static extractWorkerParams(url) {
        const params = new URLSearchParams(url.search);
        
        return {
            disableWorker: params.get('cfw') === 'false',
            bypassCDN: params.get('cf-cdn') === 'false',
            bypassR2: params.get('r2-cdn') === 'false',
            revalidate: params.get('cf-revalidate') === 'true',
            delete: params.get('cf-delete') === 'true',
            purge: params.get('cf-purge') !== null,
            customTTL: params.get('cf-ttl'),
            setVersion: params.get('cf-version'),
            r2Race: params.get('r2-race')
        };
    }

    /**
     * Check if URL should bypass cache
     * @param {Request} request - Request object
     * @param {string[]} bypassPatterns - Array of bypass URL patterns
     * @returns {boolean} True if should bypass
     */
    static shouldBypassURL(request, bypassPatterns) {
        const url = request.url;
        
        // Only cache GET requests
        if (request.method !== 'GET') {
            return true;
        }

        // Check bypass patterns
        for (const pattern of bypassPatterns) {
            if (url.indexOf(pattern) >= 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if URL should always be cached
     * @param {string} url - URL to check
     * @param {string[]} cacheAlwaysPatterns - Array of always-cache patterns
     * @returns {boolean} True if should always cache
     */
    static shouldAlwaysCache(url, cacheAlwaysPatterns) {
        for (const pattern of cacheAlwaysPatterns) {
            if (url.indexOf(pattern) >= 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Generate cache key for request
     * @param {Request} request - Request object
     * @param {number} cacheVersion - Cache version number
     * @param {boolean} mobileCacheDifferent - Use separate mobile cache
     * @returns {string} Cache key URL
     */
    static generateCacheKey(request, cacheVersion, mobileCacheDifferent = false) {
        const url = new URL(request.url);
        const normalizedUrl = this.normalizeUrl(url);
        
        // Add cache version parameter
        normalizedUrl.searchParams.set('cf_edge_cache_ver', cacheVersion.toString());

        // Add mobile indicator if needed
        if (mobileCacheDifferent) {
            const isMobile = this.isMobileDevice(request);
            if (isMobile) {
                normalizedUrl.searchParams.set('cf_mobile', '1');
            }
        }

        return normalizedUrl.toString();
    }

    /**
     * Check if request is from mobile device
     * @param {Request} request - Request object
     * @returns {boolean} True if mobile device
     */
    static isMobileDevice(request) {
        const userAgent = request.headers.get('User-Agent') || '';
        return /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
    }

    /**
     * Parse boolean string value
     * @param {string} str - String to parse
     * @returns {boolean} Parsed boolean value
     */
    static parseBoolean(str) {
        if (typeof str === 'boolean') {
            return str;
        }
        if (typeof str === 'string') {
            return str.toLowerCase() === 'true' || str === '1';
        }
        return false;
    }
}
