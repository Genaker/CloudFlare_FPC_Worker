/**
 * Cookie Utilities
 * Functions for cookie parsing and validation
 */

/**
 * Cookie Handler class
 */
export class CookieHandler {
    /**
     * Check if request should bypass cache based on cookies
     * @param {Request} request - Request object
     * @param {string[]} bypassCookies - Array of bypass cookie prefixes
     * @returns {boolean} True if should bypass
     */
    static shouldBypassCache(request, bypassCookies) {
        const cookieHeader = request.headers.get('cookie');
        
        if (!cookieHeader) {
            return false;
        }

        return this.checkCookies(cookieHeader, bypassCookies);
    }

    /**
     * Check if cookies contain any bypass patterns
     * @param {string} cookieHeader - Cookie header string
     * @param {string[]} bypassCookies - Array of bypass cookie prefixes
     * @returns {boolean} True if bypass cookie found
     */
    static checkCookies(cookieHeader, bypassCookies) {
        if (!cookieHeader || !bypassCookies || bypassCookies.length === 0) {
            return false;
        }

        const cookies = cookieHeader.split(';');
        
        for (const cookie of cookies) {
            const cookieName = cookie.trim().split('=')[0];
            
            for (const bypassPrefix of bypassCookies) {
                if (cookieName.indexOf(bypassPrefix) === 0) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get cookie value by name
     * @param {string} cookiesString - Cookie header string
     * @param {string} name - Cookie name to find
     * @returns {string|null} Cookie value or null
     */
    static getCookie(cookiesString, name) {
        if (!cookiesString) {
            return null;
        }

        const cookies = cookiesString.split(';');
        
        for (const cookie of cookies) {
            const [cookieName, cookieValue] = cookie.trim().split('=');
            if (cookieName === name) {
                return cookieValue || null;
            }
        }

        return null;
    }

    /**
     * Get cache variation based on cookies
     * @param {Request} request - Request object
     * @param {string[]} versionCookies - Array of version cookie names
     * @returns {string} Cache variation identifier
     */
    static getCacheVariation(request, versionCookies) {
        const cookieHeader = request.headers.get('cookie');
        
        if (!cookieHeader) {
            return '';
        }

        const variations = [];
        
        for (const cookieName of versionCookies) {
            const value = this.getCookie(cookieHeader, cookieName);
            if (value) {
                variations.push(`${cookieName}=${value}`);
            }
        }

        return variations.join('&');
    }
}
