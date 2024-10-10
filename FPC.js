// IMPORTANT: Either A Key/Value Namespace must be bound to this worker script
// using the variable name EDGE_CACHE. or the API parameters below should be
// configured. KV is recommended if possible since it can purge just the HTML
// instead of the full cache.

// Separate cache for the mobile devices
const MOBILECACHE_DIFFERENT = false;

// API settings if KV isn't being used
const CLOUDFLARE_API = {
    email: "", // From https://dash.cloudflare.com/profile
    key: "", // Global API Key from https://dash.cloudflare.com/profile
    zone: "" // "Zone ID" from the API section of the dashboard overview page https://dash.cloudflare.com/
};

// No cache values
const CACHE_CONTROL_NO_CACHE = [
    'no-cache',
    'no-store'
];

// Default cookie prefixes for logged-in users
const VERSION_COOKIES = [
    "X-Magento-Vary"
];

// Default cookie prefixes for bypass
const DEFAULT_BYPASS_COOKIES = [
    //"X-Magento-Vary"
];

const DEBUG = true;

// Filtered get parameters
const FILTER_GET = [
    // Facebook related
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'fbclid',
    // google related
    'gclid',
    'gclsrc',
    'customer-service',
    'terms-of-service',
    '_ga',
    'add',
    'srsltid', //new google parameter
    // worker specific
    'cf-cdn',
    'r2-cdn',
    'cf-delete',
    'cf-ttl'
];

const CACHE_STATUSES = [
    200,
    301,
    302,
    404
];

//Whitelisted GET parameters
const ALLOWED_GET = [
    'product_list_order',
    'p',
    'product_list_limit',
    'q',
    'fpc',
    'price'
];

// URLs will not be cached
const BYPASS_URL = [
    'order',
    'onestepcheckout',
    'admin',
    'checkout',
    'paypal',
    'cart',
    'static',
    'media',
    'api',
    'rest',
    'ajax',
    'frontend_action',
    'searchspring',
    'customer',
    'compare',
    'tracking',
    'account',
    'feedonomics',
    'estimateddeliverydate',
    'original-page',
    'fpc'
];

// URL will always be cached no matter what
const CACHE_ALWAYS = [
    'customer-service',
    'banner/ajax/load'
]

//Some legacy stuff. Bots doesn't have it and produces cache MISSES
const ACCEPT_CONTENT_HEADER = 'Accept';
// Revalidate the cache every N sec
// User will receive old/stale version
const REVALIDATE_AGE = 360;

/**
* Main worker entry point.
*/
addEventListener("fetch", async event => {
    let startWorkerTime = Date.now();
    console.log(event.request);
    let context = {
        event: event,
        promise: null,
        'r2-stale': false,
        'CDN-miss': false, //emulate cache miss on CDN
        'CDN-ttl': 99999999999, //ttl to test revalidation
        'R2-miss': false, // Emulate cache miss on Page Reserve 
        'CDN-delete': false // Delete page for test 
    }
    const request0 = event.request;

    const cacheUrl = new URL(request0.url);

    //Saving worker specific GET parameters to context before URL normalisation
    if (cacheUrl.searchParams.get('cfw') === "false") {
        console.log("bypass worker");
        event.passThroughOnException();
        event.respondWith(fetch(request0));
        return true;
    }
    if (cacheUrl.searchParams.get('cf-cdn') === "false") {
        context["CDN-miss"] = true;
        cacheUrl.searchParams.delete('cf-cdn');
    }
    if (cacheUrl.searchParams.get('r2-cdn') === "false") {
        context["R2-miss"] = true;
        cacheUrl.searchParams.delete('r2-cdn');
    }
    if(cacheUrl.searchParams.get('cf-delete') === "true"){
        context["CDN-delete"] = true;
        cacheUrl.searchParams.delete('cf-delete');
    }
    if(cacheUrl.searchParams.get('cf-ttl')){
        context["CDN-ttl"] = parseInt(cacheUrl.searchParams.get('cf-ttl'));;
        cacheUrl.searchParams.delete('cf-ttl');
    }

    // Hostname for a different zone
    if (typeof OTHER_HOST !== 'undefined') {
        console.log("Other Host: " + OTHER_HOST);
        cacheUrl.hostname = OTHER_HOST;
    }

    // Remove marketing GET parameters from the URL
    let normalizedUrl = normalizeUrl(cacheUrl);

    const request = new Request(normalizedUrl.toString(), request0);

    console.log(request);

    let upstreamCache = request.headers.get('x-HTML-Edge-Cache');

    // Only process requests if KV store is set up and there is no
    // HTML edge cache in front of this worker (only the outermost cache
    // should handle HTML caching in case there are varying levels of support).
    let configured = false;

    if (typeof R2 !== 'undefined') {
        console.log('R2 is working!!');
    } else {
        console.log('R2 is not working!!');
        const R2 = false;
    }

    if (typeof EDGE_CACHE !== 'undefined') {
        console.log('KV is working!!');
        configured = true;
    } else if (CLOUDFLARE_API.email.length && CLOUDFLARE_API.key.length && CLOUDFLARE_API.zone.length) {
        configured = true;
    }
    // temporary
    configured = true;

    // Bypass processing of image requests (for everything except Firefox which doesn't use image/*)
    const accept = request.headers.get(ACCEPT_CONTENT_HEADER);
    let isImage = false;
    if (accept && (accept.indexOf('image/*') !== -1)) {
        isImage = true;
    }

    if (configured && !isImage && upstreamCache === null) {
        event.passThroughOnException();
        let resultResponse = processRequest(request, context);
        event.respondWith(resultResponse);
        console.log(context);

    }

});

/**
* Process every request coming through to add the edge-cache header,
* watch for purge responses and possibly cache HTML GET requests.
*
* @param {Request} originalRequest - Original request
* @param {Object} context - Original event context (for additional async waiting)
*/
async function processRequest(originalRequest, context) {
    let startWorkerTime = Date.now();
    let event = context.event;
    let cfCacheStatus = null;
    let originTimeStart = 0;
    let originTimeEnd = 0;
    const accept = originalRequest.headers.get(ACCEPT_CONTENT_HEADER);
    let isHTML = true;//(accept && accept.indexOf('text/html') >= 0);

    console.log("isHTML: " + isHTML);
    //Cache everything by default
    //ToDo: exclude some mime types
    isHTML = true;
    let getCachedTimeStart = Date.now();
    let { response, cacheVer, status, bypassCache, needsRevalidate, cacheAlways } = await getCachedResponse(originalRequest, context);
    let getCachedTimeEnd = Date.now();

    // Request to purge cache by Adding Version
    if (originalRequest.url.indexOf('cf-purge') >= 0) {
        console.log("Clearing the cache");
        let newCacheVersion = await purgeCache(cacheVer, event);
        status += ',Purged,';
        return new Response("Cache Purged (NEW VERSION " + (cacheVer + 1) + ") Successfully!!", {
            headers: new Headers({'cache-version': newCacheVersion}), status: 222});
    }

    if (response === null) {
        console.log("Not From Cache");
        // Clone the request, add the edge-cache header and send it through.
        let request = new Request(originalRequest);
        request.headers.set('x-HTML-Edge-Cache', 'supports=cache|purgeall|bypass-cookies');

        status += ',FetchedOrigin,';
        originTimeStart = Date.now();

        // Fetch it from origin
        response = await fetch(request, {
            cf: {
                // Always cache this fetch regardless of content type
                // for a max of 15 seconds before revalidating the resource
                // cacheTtl: 15,
                // cacheEverything: true
            },
        });
        originTimeEnd = Date.now();
        console.log("Origin-Time:" + (originTimeEnd - originTimeStart).toString());

        //ToDo: Seams redundant refactor
        if (response) {
            console.log("Origin CF Cache Status: " + response.headers.get('cf-cache-status'));
            if (response.headers.get('cf-cache-status') === "HIT") {
                status += ',CF-HIT,';
            }
            console.log("response from Origin ");
            const options = getResponseOptions(response);
            console.log('URL path: ' + request.url);
            if (options && options.purge) {
                console.log("Clearing the cache");
                await purgeCache(cacheVer, event);
                status += ',Purged,';
            }
            bypassCache = bypassCache || shouldBypassEdgeCache(request, response);
            console.log("bypassCache: " + bypassCache);
            console.log("options: " + options);

            //Cache everything by default
            //if(options === null) options.cache = true;

            if ((!options || options.cache) && isHTML &&
                originalRequest.method === 'GET' && CACHE_STATUSES.includes(response.status) &&
                !bypassCache) {
                console.log("Caching...");
                status += ",Caching Async,";
                event.waitUntil(cacheResponse(cacheVer, originalRequest, response, context, cacheAlways));
                console.log("Status: " + status);
            } else {
                console.log("Bypass The cache:" + request.url);
                status += ",Bypassed,";
            }
        }
    } else {
        // If the origin didn't send the control header we will send the cached response but update
        // the cached copy asynchronously (stale-while-revalidate). This commonly happens with
        // a server-side disk cache that serves the HTML directly from disk.
        // ToDo: Code variables to disable this feature.
        cfCacheStatus = 'HIT';
        console.log("Cache HIT!!!");
        console.log(response);
        // Nen revalidate when fetched previous version
        if (needsRevalidate) {
            status += ',Stale,';
            console.log("Hit from the previous version Needs Revalidate: Current V: " + cacheVer + " Previous: " + (cacheVer - 1))
        }
        if (originalRequest.method === 'GET' && CACHE_STATUSES.includes(response.status) && isHTML) {
            bypassCache = bypassCache || shouldBypassEdgeCache(originalRequest, response);
            if (needsRevalidate || !bypassCache) {
                const options = getResponseOptions(response);
                if (needsRevalidate || !options) {
                    let age = parseInt(response.headers.get('age'));
                    // If the cache is new, don't send the backend request
                    if (needsRevalidate || age > context["CDN-ttl"] || age > REVALIDATE_AGE) {
                        status += ',Refreshed,';
                        console.log("Refresh Cache");
                        // In service workers, waitUntil() tells the browser that work is ongoing until
                        // the promise settles, and it shouldn't terminate the service worker if it wants that work to be complete.
                        // ToDO: optimize this stuff for better server performance by reducing backend server requests
                        event.waitUntil(updateCache(originalRequest, cacheVer, event, cacheAlways));
                    } else {
                        status += ',Stale_' + age + ',';
                    }
                }
            }
        }
    }

    if (response && status !== null && originalRequest.method === 'GET' && CACHE_STATUSES.includes(response.status) && isHTML) {
        let responseBody = response.clone().body;
        response = new Response(responseBody, response);
        response.headers.set('Origin-Time', (originTimeEnd - originTimeStart).toString());
        if (needsRevalidate) {
            response.headers.set('Stale', 'true');
        }
        if (context['CDN-ttl'] < 9999){
            response.headers.set('Custom-TTL', context['CDN-ttl'].toString());
        }

        response.headers.set('Cache-Check-Time', (getCachedTimeEnd - getCachedTimeStart).toString());

        status = status.replaceAll(",,", ",");
        status = status.replaceAll(" ", "");
        if (DEBUG)
            response.headers.set('x-HTML-Edge-Cache-Status', status);
        if (cacheVer !== null) {
            if (DEBUG)
                response.headers.set('x-HTML-Edge-Cache-Version', cacheVer.toString());
        }
        if (cfCacheStatus) {
            if (DEBUG)
                response.headers.set('CF-Cache-Status', cfCacheStatus);
            response.headers.set('CF-Loc', btoa(cfCacheStatus));
            response.headers.set('Cache-Control', 'max-age=0, must-revalidate');
        }
        // Hide default CF values
        if (!DEBUG && cfCacheStatus) {
            response.headers.delete('CF-Cache-Status');
            response.headers.delete('Age');
            response.headers.set('CF-Cache-Status', 'DYNAMIC');
            response.headers.set('X-Magento-Cache-Debug', 'MIS');
            response.headers.set('X-Varnish', Date.now() + " " + (Date.now() - 999));
        }
        if(context['r2-stale']) {
            response.headers.set('R2-stale', "true");
        }
        let endWorkerTime = Date.now();
        console.log("Worker-Time: " + (endWorkerTime - startWorkerTime).toString());
        response.headers.set("Worker-Time", (endWorkerTime - startWorkerTime).toString());
        let jsTime = ((endWorkerTime - startWorkerTime) - (originTimeEnd - originTimeStart)).toString()
        response.headers.set("JS-Time", jsTime);
        console.log("JS-Time: " + jsTime);
    }
    console.log("Return Response");
    //console.log("HTML:" + await response.clone().text());
    //console.log("HTML size:" + (await response.clone().arrayBuffer()).byteLength / 1000 + "Kb");

    return response;
}

/**
* Determine if the cache should be bypassed for the given request/response pair.
* Specifically, if the request includes a cookie that the response flags for bypass.
* Can be used on cache lookups to determine if the request needs to go to the origin and
* origin responses to determine if they should be written to cache.
* @param {Request} request - Request
* @param {Response} response - Response
* @returns {bool} true if the cache should be bypassed
*/
function shouldBypassEdgeCache(request, response) {
    let bypassCache = false;

    if (request /*&& response*/) {
        const options = false; // = getResponseOptions(response);
        const cookieHeader = request.headers.get('cookie');
        let bypassCookies = DEFAULT_BYPASS_COOKIES;

        //CAHE_LOGGEDIN_USERS

        if (cookieHeader && cookieHeader.length && bypassCookies.length) {
            const cookies = cookieHeader.split(';');
            for (let cookie of cookies) {
                // See if the cookie starts with any of the logged-in user prefixes
                for (let prefix of bypassCookies) {
                    if (cookie.trim().startsWith(prefix)) {
                        bypassCache = true;
                        break;
                    }
                }
                if (bypassCache) {
                    break;
                }
            }
        }
    }

    return bypassCache;
}

function shouldBypassURL(request) {
    let bypassCache = false;

    if (BYPASS_URL && BYPASS_URL.length) {
        //console.log(BYPASS_URL);
        for (let pass of BYPASS_URL) {
            // See if the URL starts with any of the logged-in user prefixes
            //console.log("check: " + pass);

            if (request.url.indexOf(pass) >= 0) {
                console.log("Should Bypass URL:" + pass);
                bypassCache = true;
                break;
            }
        }
    }
    return bypassCache;
}

const CACHE_HEADERS = ['Cache-Control', 'Expires', 'Pragma'];

/**
* Check for cached HTML GET requests.
*
* @param {Request} request - Original request
* @param {Object} context - context container object 
*/
async function getCachedResponse(request, context) {
    let response = null;
    let event = context.event;
    let cacheVer = null;
    let bypassCache = false;
    let byPassUrl = false;
    let status = '';
    let cacheAlways = false;
    let fromR2 = false;
    let R2check = true;
    let R2StaleUsed = false;
    let cachedResponse = null;
    let staleCachePromise = null;

    // Only check for HTML GET requests (saves on reading from KV unnecessarily)
    // and not when there are cache-control headers on the request (refresh)
    const accept = request.headers.get(ACCEPT_CONTENT_HEADER);
    const cacheControl = request.headers.get('Cache-Control');

    for (let url of CACHE_ALWAYS) {
        if (request.url.indexOf(url) >= 0) {
            console.log("Always Cache URL:" + url + " in " + request.url);
            cacheAlways = true;
            status += ',AlwaysCache,';
            break;
        }
    }

    // Always cache some URLs
    if (!cacheAlways) {
        byPassUrl = shouldBypassURL(request);

        // Bypass static files
        if (byPassUrl) {
            status += ',BypassURL,';
            console.log(status + " : " + request.url);
            bypassCache = true;
        } else {
            // Check to see if the response needs to be bypassed because of a cookie
            bypassCache = shouldBypassEdgeCache(request, null);
            if (bypassCache)
                status += ',BypassCookie,';
        }
    }

    let noCache = false;
    let needsRevalidate = false;

    /*if (cacheControl && cacheControl.indexOf('no-cache') !== -1) {
    noCache = true;
    bypassCache = true;
    status = 'No-Cache';
    }*/

    if (!bypassCache && !noCache && request.method === 'GET' /*&& accept && accept.indexOf('text/html') >= 0*/) {
        // Build the versioned URL for checking the cache
        cacheVer = await getCurrentCacheVersion(cacheVer);
        console.log("Getting from cache:");

        const cacheKeyRequest = GenerateCacheRequestUrlKey(request, cacheVer, cacheAlways);
        const staleCacheKeyRequest = GenerateCacheRequestUrlKey(request, cacheVer - 1, cacheAlways);
        console.log(cacheKeyRequest);

        // in case of debugging uncomment this
        //status += "[" + cacheKeyRequest.url.toString() + "]";
        // See if there is a request match in the cache
        try {
            let cache = caches.default;
            let deleted = false;

            // Delete page from local CDN for tests purposes 
            // But not deleted from Cache Reserve page is still in cache 
            if(context["CDN-delete"]) {
                let deleteStatus = await cache.delete(cacheKeyRequest);
                status += ",Deleted,";
                let headers = new Headers();
                headers.set("Deleted", "true");
                headers.set("Delete-Status", "" + deleteStatus);
                cachedResponse = new Response("Deleted URL: " + cacheKeyRequest.url, {
                    headers: headers, status: 211
                });
                deleted = true;
            }

            if(!deleted){
                // check the previous version of the cache before purge and soft revalidate
                // requestin in advance to save time 
                staleCachePromise = cache.match(staleCacheKeyRequest);
                cachedResponse = await cache.match(cacheKeyRequest);
                if (!cachedResponse) {
                    // Return the previous version of the cache ...
                    cachedResponse = await Promise.resolve(staleCachePromise);
                    needsRevalidate = true;
                }
            }

            let requestUrl = new URL(request.url);
            // Bypass just CDN cache for test purpuses to imulate cache miss 
            // like from another location/POP
            if (context['CDN-miss']) {
                cachedResponse = null;
                staleCachePromise = null;
            }
            if (cachedResponse) {
                console.log("From CDN EDGE cache");
            }

            let useStale = true;       

            if (cachedResponse) {
                // Copy Response object so that we can edit headers.
                cachedResponse = new Response(cachedResponse.body, cachedResponse);
                if(needsRevalidate) {
                    cachedResponse.headers.set('stale-version', (cacheVer - 1).toString());
                }
                if(R2StaleUsed) {
                    cachedResponse.headers.set('r2-stale', "true");
                    context['r2-stale'] = true;
                } 
                if(!R2StaleUsed && needsRevalidate) {
                    cachedResponse.headers.set('cdn-stale', "true");
                } 
                if (DEBUG)
                    cachedResponse.headers.set("Key", cacheKeyRequest.url.toString());

                // ToDo: bypassCache is always false inside this IF. Refactor needed
                // Copy the original cache headers back and clean up any control headers

                status += ',Hit,';
                console.log(status);
                cachedResponse.headers.delete('Cache-Control');
                if (!fromR2) {
                    cachedResponse.headers.delete('R2-Status');
                    cachedResponse.headers.delete('R2-Time');
                }
                cachedResponse.headers.delete('x-HTML-Edge-Cache-Status');

                for (let header of CACHE_HEADERS) {
                    let value = cachedResponse.headers.get('x-HTML-Edge-Cache-Header-' + header);
                    if (value) {
                        cachedResponse.headers.delete('x-HTML-Edge-Cache-Header-' + header);
                        cachedResponse.headers.set(header, value);
                    }
                }
                if (DEBUG)
                    cachedResponse.headers.set("VARNISH", "[" + cacheKeyRequest.url.toString() + "]");
                response = cachedResponse;
            } else {
                status += ',Miss,';
                console.log(status);
            }
        } catch (err) {
            // Send the exception back in the response header for debugging
            status += ",Cache Read Exception: " + err.message + ",";
        }
    }

    return { response, cacheVer, status, bypassCache, needsRevalidate, cacheAlways };
}


/**
* Asynchronously purge the HTML cache.
* @param {Int} cacheVer - Current cache version (if retrieved)
* @param {Event} event - Original event
*/
async function purgeCache(cacheVer, event) {
    if (typeof EDGE_CACHE !== 'undefined') {
        // Purge the KV cache by bumping the version number
        cacheVer = await getCurrentCacheVersion(cacheVer);
        cacheVer++;
        event.waitUntil(EDGE_CACHE.put('html_cache_version', cacheVer.toString()));
    } else {
        // Purge everything using the API
        const url = "https://api.cloudflare.com/client/v4/zones/" + CLOUDFLARE_API.zone + "/purge_cache";
        event.waitUntil(fetch(url, {
            method: 'POST',
            headers: {
                'X-Auth-Email': CLOUDFLARE_API.email,
                'X-Auth-Key': CLOUDFLARE_API.key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ purge_everything: true })
        }));
    }
    return cacheVer;
}

/**
* Update the cached copy of the given page
* @param {Request} originalRequest - Original Request
* @param {String} cacheVer - Cache Version
* @param {Event} event - Original event
*/
async function updateCache(originalRequest, cacheVer, event, cacheAlways) {
    // Clone the request, add the edge-cache header and send it through.
    let request = new Request(originalRequest);
    let status = "";
    request.headers.set('x-HTML-Edge-Cache', 'supports=cache|purgeall|bypass-cookies');
    let response = await fetch(request);

    if (response) {
        status += ',Fetched,';
        const options = getResponseOptions(response);
        if (options && options.purge) {
            await purgeCache(cacheVer, event);
        }
        let bypassCache = shouldBypassEdgeCache(request, response);
        if ((!options || options.cache) && !bypassCache) {
            await cacheResponse(cacheVer, originalRequest, response, event, cacheAlways);
        }
    }
}

/**
* Cache the returned content (but only if it was a successful GET request)
*
* @param {Int} cacheVer - Current cache version (if already retrieved)
* @param {Request} request - Original Request
* @param {Response} originalResponse - Response to (maybe) cache
* @param {Object} context - Original event
* @param {boolean} cacheAlways - Cache Always Flag
* @returns {bool} true if the response was cached
*/
async function cacheResponse(cacheVer, request, originalResponse, context, cacheAlways) {
    let status = "";
    const accept = request.headers.get(ACCEPT_CONTENT_HEADER);
    console.log("ACCEPT_CONTENT_HEADER: " + accept);
    if (request.method === 'GET' && CACHE_STATUSES.includes(originalResponse.status) /*&& accept && accept.indexOf('text/html') >= 0*/) {
        cacheVer = await getCurrentCacheVersion(cacheVer);
        const cacheKeyRequest = GenerateCacheRequestUrlKey(request, cacheVer, cacheAlways);

        try {
            // Move the cache headers out of the way so the response can actually be cached.
            // First, clone the response so there is a parallel body stream and then
            // Create a new response object based on the clone that we can edit.
            let cache = caches.default;
            let clonedResponse = originalResponse.clone();
            //originalResponse.body.cancel();
            let response = new Response(clonedResponse.body, clonedResponse);
            for (let header of CACHE_HEADERS) {
                let value = response.headers.get(header);
                if (value) {
                    response.headers.delete(header);
                    response.headers.set('x-HTML-Edge-Cache-Header-' + header, value);
                }
            }
            response.headers.delete('Set-Cookie');
            response.headers.delete('Cache-Control');
            response.headers.delete('Pragma');
            //response.headers.set('Cache-Control', 'public; max-age=315360000; stale-if-error=3600');
            response.headers.set('Cache-Control', 'public; s-max-age=315360000');

            console.log("Cached:");
            console.log(cacheKeyRequest);
            //console.log(response);
            let cdnCachedResponse = response.clone();
            cdnCachedResponse.headers.delete("R2");
            cdnCachedResponse.headers.delete("R2-Get");

            let cachePromiss = cache.put(cacheKeyRequest, cdnCachedResponse);
            status += ",Saved CDN,";
            context.version = cacheVer.toString();

            // Wait for cache Promise
            await Promise.resolve(cachePromiss);
        } catch (err) {
            console.log("Catch Cache Error: " + err.message);
            status += ",Cache Response Exception:" + err.message + ",";
        }
    }
    return status;
}


/******************************************************************************
* Utility Functions
*****************************************************************************/

/**
* Parse the commands from the x-HTML-Edge-Cache response header.
* @param {Response} response - HTTP response from the origin.
* @returns {*} Parsed commands
*/
function getResponseOptions(response) {
    let options = null;
    let header = response.headers.get('x-HTML-Edge-Cache');
    if (header) {
        //DoDo: Refactor
        options = {
            purge: false,
            cache: false,
            bypassCookies: []
        };
        let commands = header.split(',');
        for (let command of commands) {
            if (command.trim() === 'purgeall') {
                options.purge = true;
            } else if (command.trim() === 'cache') {
                options.cache = true;
            } else if (command.trim().startsWith('bypass-cookies')) {
                let separator = command.indexOf('=');
                if (separator >= 0) {
                    let cookies = command.substr(separator + 1).split('|');
                    for (let cookie of cookies) {
                        cookie = cookie.trim();
                        if (cookie.length) {
                            options.bypassCookies.push(cookie);
                        }
                    }
                }
            }
        }
    }

    return options;
}

function getResponseCacheControl(response) {
    let cache = true;
    let header = response.headers.get('cache-control');
    if (header) {
        let cacheControls = header.split(',');
        for (let cacheControl of cacheControls) {

        }
    }

    return cache;
}

/**
* Retrieve the current cache version from KV
* @param {Int} cacheVer - Current cache version value if set.
* @returns {Int} The current cache version.
*/
async function getCurrentCacheVersion(cacheVer) {
    if (cacheVer === null) {
        if (typeof EDGE_CACHE !== 'undefined') {
            cacheVer = await EDGE_CACHE.get('html_cache_version');

            if (cacheVer === null || cacheVer > 1000) {
                // 1000 is overflow protection
                // Uninitialized - first time through, initialize KV with a value
                // Blocking but should only happen immediately after worker activation.
                cacheVer = 0;
                await EDGE_CACHE.put('html_cache_version', cacheVer.toString());
            } else {
                cacheVer = parseInt(cacheVer);
            }
        } else {
            cacheVer = -1;
        }
    }
    console.log('Cache Version:' + cacheVer);

    return cacheVer;
}

const getDeviceType = (userAgent) => {
    const ua = userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return "tablet";
    }
    if (
        /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
            ua
        )
    ) {
        return "mobile";
    }
    return "desktop";
};

/**
* Generate the versioned Request object to use for cache operations.
* @param {Request} request - Base request
* @param {Int} cacheVer - Current Cache version (must be set)
* @param {boolean} cacheAlways - cache always flag
* @returns {Request} Versioned request object
*/
function GenerateCacheRequestUrlKey(request, cacheVer, cacheAlways) {

    //Add additional parameters Cache Version for Logged In users
    let additionalParam = '';
    const cookieHeader = request.headers.get('cookie');
    // Add Version Cookie
    let versionKeys = VERSION_COOKIES;

    if (MOBILECACHE_DIFFERENT === true) {
        // Requires Enterprise "CF-Device-Type Header" zone setting or
        let device = request.headers.get("CF-Device-Type");
        console.log("Device: " + device);
        // If the device is mobile, add something to the cache key.

        if (device === "mobile") {
            additionalParam += "mobile";
        } else {
            additionalParam += "default";
        }

        // On User Agent
        const device2 = getDeviceType(request.headers.get("User-Agent"));
        additionalParam += device2;
    }

    if (cookieHeader && cookieHeader.length && versionKeys.length) {
        const cookies = cookieHeader.split(';');
        for (let cookie of cookies) {
            // See if the cookie starts with any version prefixes
            for (let key of versionKeys) {
                if (cookie.trim().startsWith(key)) {
                    additionalParam += cookie;
                }
            }
        }
    }
    // if the additional param is not empty
    if (additionalParam.length > 2) {
        additionalParam = '&additional=' + btoa(additionalParam);
    }

    if (cacheAlways) {
        let newUrl = new URL(request.url);
        for (var key of newUrl.searchParams.keys()) {
            //console.log("Key to filter:" + key);
            // Cache Always Ignoring Any URL parameters
            newUrl.searchParams.delete(key);
        }
        request = new Request(newUrl.toString(), request);
    }

    let cacheUrl = request.url;
    if (cacheUrl.indexOf('?') >= 0) {
        cacheUrl += '&';
    } else {
        cacheUrl += '?';
    }
    cacheUrl += 'cf_edge_cache_ver=' + cacheVer + additionalParam;
    return new Request(cacheUrl);
}

function normalizeUrl(url) {
 //   for (var key of url.searchParams.keys()) {
        //console.log("Key to filter:" + key);

        for (var filter of FILTER_GET) {
          //  if (filter === key) {
                // console.log("Filtered Key:" + key);
                url.searchParams.delete(filter);
        //    }
        }
   // }
    return url;
}