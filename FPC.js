// IMPORTANT: Either A Key/Value Namespace must be bound to this worker script
// using the variable name KV. or the API parameters below should be
// configured. KV is recommended if possible since it can purge just the HTML
// instead of the full cache.

// Separate cache for the mobile devices
var MOBILECACHE_DIFFERENT = false;

var KV_CONFIG_LAST_SYNC = null;

var KV_CONFIG_CHECK = [];
var KV_CONFIG = [];
var JSON_CONFIG = {};

var IP_count = [];

//KV Config doesn't make sens. ENV var change automatically deploys new Worker version 
var KV_CONFIG_ENABLED = false;

//limited to 128 MB
var WORKER_CACHE_STORAGE = [];
var WORKER_CACHE_STAT = [];

// API settings if KV isn't being used
var CLOUDFLARE_API = {
    email: "", // From https://dash.cloudflare.com/profile
    key: "", // Global API Key from https://dash.cloudflare.com/profile
    zone: "" // "Zone ID" from the API section of the dashboard overview page https://dash.cloudflare.com/
};

// No cache values
var CACHE_CONTROL_NO_CACHE = [
    'no-cache',
    'no-store'
];

// Default cookie prefixes for logged-in users
var VERSION_COOKIES = [
    "X-Magento-Vary"
];

// Default cookie prefixes for bypass
var DEFAULT_BYPASS_COOKIES = [
    'admin'
    //"X-Magento-Vary"
];

var R2_CAHE_LOGGEDIN_USERS = false;
const USER_COOKIES = [
    'X-Magento-Vary'
];

const FORM_KEY = 'form_key';

const CSPRO_HEADER = 'content-security-policy-report-only';
var CSPRO_REMOVE = true;

var ADMIN_URL = null;

// Filtered get parameters
var FILTER_GET = [
    // Facebook related
    'fbclid',
    'fb_ad',
    'fb_adid',
    'fb_adset',
    'fb_campaign',
    'fb_adsetid',
    'fb_campaignid',
    'utm_id',
    'utm_source',
    'matchtype',
    'addisttype',
    'adposition',
    'gad_source',
    'utm_term',
    'utm_medium',
    'utm_cam',
    'utm_campaign',
    'utm_content',
    'utm_creative',
    'utm_adcontent',
    'utm_adgroupid',
    'wbraid',
    'epik',
    '_hsenc',
    '_hsmi',
    '__hstc',
    'affiliate_code',
    'referring_service',
    'hsa_cam',
    'hsa_acc',
    'msclkid',
    'hsa_grp',
    'hsa_ad',
    'hsa_src',
    'hsa_net',
    'hsa_ver',
    'dm_i',
    'dm_t',
    'ref',
    'trk',
    'uuid',
    'dicbo',
    'adgroupid',
    // google related
    'g_keywordid',
    'g_keyword',
    'g_campaignid',
    'g_campaign',
    'g_network',
    'g_adgroupid',
    'g_adtype',
    'g_acctid',
    'g_adid',
    'cq_plac',
    'cq_net',
    'cq_pos',
    'cq_med',
    'cq_plt',
    'b_adgroup',
    'b_adgroupid',
    'b_adid',
    'b_campaign',
    'b_campaignid',
    'b_isproduct',
    'b_productid',
    'b_term',
    'b_termid',
    'msclkid',
    'gbraid',
    'gclid',
    'gclsrc',
    'customer-service',
    'terms-of-service',
    '_ga',
    '_gl',
    'add',
    'srsltid', //new google parameter
    // worker specific
    'click',
    'gtm_debug',
    'cf-cdn',
    'r2-cdn',
    'cf-delete',
    'cf-ttl',
    'cf-revalidate'
];

var CACHE_STATUSES = [
    200,
    301,
    //302, Bots creats a lot of riddirects of this type. 
    //404
];

var ALLOWED_GET_ONLY = false;
//Whitelisted GET parameters
var ALLOWED_GET = [
    'product_list_order',
    'p',
    'product_list_limit',
    'q',
    'fpc',
    'price',
    'id',
    'limit',
    'order',
    'mode'
];

// URLs will not be cached
var BYPASS_URL = [
    'order',
    'onestepcheckout',
    'admin',
    'checkout',
    'catalogsearch',
    'paypal',
    'cart',
    'static/',
    'media/',
    'api',
    'rest/',
    'ajax',
    'frontend_action',
    'searchspring',
    'customer',
    'compare',
    'tracking',
    'account',
    'feedonomics',
    'estimateddeliverydate',
    'original-page'
];

// URL will always be cached no matter what
var CACHE_ALWAYS = [
    'customer-service',
    'banner/ajax/load'
]

//Some legacy stuff. Bots doesn't have it and produces cache MISSES
var ACCEPT_CONTENT_HEADER = 'Accept';

// Config variables will be assigned in the main loop.
var DEBUG;
var CUSTOM_CORS;
var CUSTOM_PRELOAD;
var CUSTOM_SPECULATION;
var SPECULATION_ENABLED;
var SPECULATION_CACHED_ONLY;
var ENABLE_ESI_BLOCKS = false;
// Prevent any cache invalidations - 100% static 
var GOD_MOD;
// Revalidate the cache every N secs
// User will receive old/stale version
var REVALIDATE_AGE;
var R2_STALE = true;
var TEST;

var HTML_CACHE_VERSION = false;
var PWA_SPECULATION_VERSION = 1;
var PWA_ENABLED = true;
var PWA_IMAGE = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IS0tIFVwbG9hZGVkIHRvOiBTVkcgUmVwbywgd3d3LnN2Z3JlcG8uY29tLCBHZW5lcmF0b3I6IFNWRyBSZXBvIE1peGVyIFRvb2xzIC0tPgo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKYXJpYS1sYWJlbD0iQ2xvdWRmbGFyZSIgcm9sZT0iaW1nIgp2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PHJlY3QKd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiCnJ4PSIxNSUiCmZpbGw9IiNmZmZmZmYiLz48cGF0aCBmaWxsPSIjZjM4MDIwIiBkPSJNMzMxIDMyNmMxMS0yNi00LTM4LTE5LTM4bC0xNDgtMmMtNCAwLTQtNiAxLTdsMTUwLTJjMTctMSAzNy0xNSA0My0zMyAwIDAgMTAtMjEgOS0yNGE5NyA5NyAwIDAgMC0xODctMTFjLTM4LTI1LTc4IDktNjkgNDYtNDggMy02NSA0Ni02MCA3MiAwIDEgMSAyIDMgMmgyNzRjMSAwIDMtMSAzLTN6Ii8+PHBhdGggZmlsbD0iI2ZhYWU0MCIgZD0iTTM4MSAyMjRjLTQgMC02LTEtNyAxbC01IDIxYy01IDE2IDMgMzAgMjAgMzFsMzIgMmM0IDAgNCA2LTEgN2wtMzMgMWMtMzYgNC00NiAzOS00NiAzOSAwIDIgMCAzIDIgM2gxMTNsMy0yYTgxIDgxIDAgMCAwLTc4LTEwMyIvPjwvc3ZnPg=="
var PWA_MANIFEST = { "theme_color": "#ffffff", "background_color": "#ffffff", "icons": [{ "sizes": "any", "src": PWA_IMAGE, "type": "image/svg+xml" }], "orientation": "any", "display": "standalone", "dir": "auto", "lang": "en-US", "id": "https://your-domain.com/", "start_url": "/", "scope": "https://your-domain.com/", "description": "Cloud Flare Magento PWA", "name": "Magento PWA", "short_name": "M2 PWA", "prefer_related_applications": false };

processConfig();

/**
* Main worker entry point.
*/
addEventListener("fetch", async event => {
    let startWorkerTime = Date.now();
    let startConfigTime = Date.now();

    let endConfigTime = Date.now();
    console.log('Config Processing Time: ' + (endConfigTime - startConfigTime).toString());  // 0

    console.log(event.request);
    let context = {
        event: event,
        promise: null,
        'r2-stale': false,
        'CDN-miss': false, // emulate cache miss on CDN
        'CDN-ttl': 99999999999, // ttl to test revalidation
        'R2-miss': false, // Emulate cache miss on Page Reserve 
        'CDN-delete': false, // Delete page for test 
        'CDN-revalidate': false,
        'set-version': "",
        'speculation': false,
        url: "",
        cookies: "",
        bypassCookies: false,
        bypassUrl: false,
        error: "",
        country: ""
    }
    const request0 = event.request;

    const cacheUrl = new URL(request0.url);

    if (PWA_ENABLED && typeof ENV_PWA_MANIFEST === 'undefined') {
        PWA_MANIFEST.scope = cacheUrl.origin;
        PWA_MANIFEST.id = cacheUrl.origin;
    }

    const bypassCookies = shouldBypassEdgeCache(event.request);
    const bypassUrl = shouldBypassURL(request0);

    const IP = event.request.headers.get('CF-Connecting-IP');

    if (typeof event.request.cf.botManagement !== 'undefined') {
        // Requires enterprise plan
        const botScore = event.request.cf.botManagement.score;
        console.log("BOT score: " + botScore.toString());
    }
    if (typeof event.request.cf.country !== 'undefined') {
        context.country = event.request.cf.country;
        console.log("Country: " + context.country);
    }

    // Saving worker specific GET parameters to context before URL normalization
    if (bypassUrl || cacheUrl.searchParams.get('cfw') === "false" || bypassCookies) {
        console.log("bypass worker");
        event.passThroughOnException();

        let headers = [{ name: "bypass-worker", value: "true" }, { name: "cf-cache-status", value: "BYPASS,WORKER,MISS" }];
        if (bypassCookies) {
            headers.push({ name: "bypass-cookies", value: "true" });
        }
        event.respondWith(fetchAndModifyHeaders(request0, headers));
        return true;
    }
    // Speculation rule Controller ;)
    if (cacheUrl.toString().indexOf('rules/speculation.json') >= 0) {
        console.log("Speculation Rule");
        event.passThroughOnException();
        event.respondWith(new Response(JSON.stringify(CUSTOM_SPECULATION), {
            headers: new Headers({ 'Content-Type': 'application/speculationrules+json', "Cache-Control": "public, max-age=604800" }), status: 200
        }));
        return true;
    }

    if (cacheUrl.toString().indexOf('cf/manifesto.json') >= 0) {
        console.log("Manifest Rule");
        event.passThroughOnException();
        event.respondWith(new Response(JSON.stringify(PWA_MANIFEST), {
            headers: new Headers({ 'Content-Type': 'application/manifest+json', "Cache-Control": "public, max-age=604800" }), status: 200
        }));
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
    if (cacheUrl.searchParams.get('cf-version') !== null) {
        context["set-version"] = cacheUrl.searchParams.get('cf-version');
        cacheUrl.searchParams.delete('set-version');
    }
    if (cacheUrl.searchParams.get('cf-delete') === "true") {
        context["CDN-delete"] = true;
        cacheUrl.searchParams.delete('cf-delete');
    }
    if (cacheUrl.searchParams.get('cf-revalidate') === "true") {
        context["CDN-revalidate"] = true;
        cacheUrl.searchParams.delete('cf-revalidate');
    }
    if (cacheUrl.searchParams.get('cf-ttl')) {
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
    context.url = normalizedUrl;

    const request = new Request(normalizedUrl.toString(), request0);

    console.log(request);

    let upstreamCache = request.headers.get('x-HTML-Edge-Cache');
    context.cookies = request.headers.get('cookie');
    let specalationRequest = request.headers.get('Sec-Purpose');
    if (specalationRequest) {
        context['speculation'] = true;
    }

    // Only process requests if KV store is set up and there is no
    // HTML edge cache in front of this worker (only the outermost cache
    // should handle HTML caching in case there are varying levels of support).
    let configured = false;

    if (typeof R2 !== 'undefined') {
        console.log('R2 is working!!');
    } else {
        console.log('R2 is not working!!');
    }

    if (typeof KV !== 'undefined') {
        console.log('KV is working!!');
        configured = true;
    } else if (CLOUDFLARE_API.email.length && CLOUDFLARE_API.key.length && CLOUDFLARE_API.zone.length) {
        configured = true;
    } else {
        context.error += "KV is not configured";
        console.log(context.error);
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

    // if revalidate request
    if (context['CDN-revalidate']) {
        response = null;
        status += ",Revalidate,";
    }

    // Request to purge cache by Adding Version
    if (originalRequest.url.indexOf('cf-purge') >= 0) {
        console.log("Clearing the cache");
        if (!GOD_MOD) {
            let newCacheVersion = await purgeCache(cacheVer, event);
            status += ',Purged,';
            return new Response("Cache Purged (NEW VERSION: " + (cacheVer + 1) + ") Successfully!!", {
                headers: new Headers({ 'cache-version': newCacheVersion }), status: 222
            });
        } else {
            status += ',GODMOD,';
            return new Response("Cache NOT Purged (NEW VERSION: GODMOD) Successfully!!", {
                headers: new Headers({ 'cache-version': "GODMOD" }), status: 222
            });
        }
    }

    // Restore version after test.
    if (context['set-version'] !== "") {
        console.log("set-version");
        if (isNaN(context['set-version'])) {
            return new Response("(NEW VERSION " + context['set-version'] + ") Set Error NaN!!", {
                headers: new Headers({ 'cache-version': context['set-version'] }), status: 553
            });
        }
        await KV.put('html_cache_version', context['set-version']);
        let newCacheVersion = context['set-version'];
        return new Response("(NEW VERSION " + newCacheVersion + ") Set Successfully!!", {
            headers: new Headers({ 'cache-version': newCacheVersion }), status: 223
        });
    }

    if (response === null) {
        if (context['speculation'] === true && SPECULATION_CACHED_ONLY) {
            return new Response("Speculation only from the CDN cache", { headers: new Headers({ "Cache-Control": "no-store,private" }), status: 406 });
        }

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
        if (ENABLE_ESI_BLOCKS) {
            let newBody = await processESI(response, context);
            response = new Response(newBody, response);
        }
        if (PWA_ENABLED) {
            let newBody = await processManifesto(response, context);
            response = new Response(newBody, response);
        }
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
            bypassCache = context.bypassCache; //|| shouldBypassEdgeCache(request, response);
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
            bypassCache = bypassCache || context.bypassCookies;
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
        response.headers.append('Server-Timing', 'fetch-origin;desc="Fetch From Origin";dur=' + (originTimeEnd - originTimeStart).toString());

        if (context.error !== "") {
            response.headers.set('CFW-Error', context.error);
        }
        if (needsRevalidate) {
            response.headers.set('Stale', 'true');
        }
        if (context['CDN-ttl'] < 9999) {
            response.headers.set('Custom-TTL', context['CDN-ttl'].toString());
        }
        if (context['CDN-revalidate']) {
            response.headers.set('CDN-Revalidate', "1");
        }

        let getCacheTime = getCachedTimeEnd - getCachedTimeStart;
        response.headers.set('Cache-Check-Time', getCacheTime.toString());
        response.headers.append('Server-Timing', 'get-cache;desc="Get CF CDN CACHE";dur=' + getCacheTime.toString());

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
        if (context['r2-stale']) {
            response.headers.set('R2-stale', "true");
        }
        let endWorkerTime = Date.now();
        console.log("Worker-Time: " + (endWorkerTime - startWorkerTime).toString());
        response.headers.set("Worker-Time", (endWorkerTime - startWorkerTime).toString());
        response.headers.append('Server-Timing', 'worker-time;desc="Total Worker Time";dur=' + (endWorkerTime - startWorkerTime).toString());

        let jsTime = ((endWorkerTime - startWorkerTime) - (originTimeEnd - originTimeStart) - getCacheTime).toString()
        response.headers.set("JS-Time", jsTime);
        response.headers.append('Server-Timing', 'js-time;desc="JS Execution Time";dur=' + jsTime);
        console.log("JS-Time: " + jsTime);
        if (CSPRO_REMOVE) {
            response.headers.delete(CSPRO_HEADER);
        }
        if (CUSTOM_PRELOAD.length != 0) {
            CUSTOM_PRELOAD.forEach((preload) => {
                response.headers.set("Link", preload);
            })
        }
        if (SPECULATION_ENABLED && !bypassCache) {
            response.headers.set("Speculation-Rules", "\"/rules/speculation.json?v=" + PWA_SPECULATION_VERSION + "\"");
        }
    }
    console.log("Return Response");
    //console.log("HTML:" + await response.clone().text());
    //console.log("HTML size:" + (await response.clone().arrayBuffer()).byteLength / 1000 + "Kb");

    //hash(await response.text(), context);
    //new Error("Error");
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
function shouldBypassEdgeCache(request, response = null) {
    let bypassCache = false;

    if (request /*&& response*/) {
        const options = false; // = getResponseOptions(response);
        const cookieHeader = request.headers.get('cookie');
        let bypassCookies = DEFAULT_BYPASS_COOKIES;

        //CAHE_LOGGEDIN_USERS
        bypassCache = checkCookies(cookieHeader, bypassCookies);
    }

    return bypassCache;
}

/**
 * Check if some cookies is set
 * 
 * @param {String} cookieHeader 
 * @param {array} bypassCookies 
 */
function checkCookies(cookieHeader, bypassCookies) {
    let bypassCache = false;
    if (cookieHeader && cookieHeader.length && bypassCookies.length) {
        const cookies = cookieHeader.split(';');
        for (let cookie of cookies) {
            // See if the cookie starts with any of the cookies
            // Example: token=29281ed8-3981-4840-a91e-382f9bd50dd2"
            // = is added to match full cookie name
            for (let prefix of bypassCookies) {
                if (cookie.trim().startsWith(prefix + "=")) {
                    bypassCache = true;
                    break;
                }
            }
            if (bypassCache) {
                break;
            }
        }
    }
    return bypassCache;
}

/**
 * Check if we should bypass url
 * bypass if url contains any of BYPASS_URL 
 * 
 * @param {Request} request - original request
 * @returns {boolean}
 */
function shouldBypassURL(request) {
    let bypassCache = false;
    let url = new URL(request.url);
    //ignoring host name
    let searchUrl = url.pathname + url.search;
    if (BYPASS_URL && BYPASS_URL.length) {
        //console.log(BYPASS_URL);
        for (let pass of BYPASS_URL) {
            // See if the URL starts with any of the logged-in user prefixes
            //console.log("check: " + pass);

            if (searchUrl.indexOf(pass) >= 0) {
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
        byPassUrl = context.bypassUrl; //|| shouldBypassURL(request);

        // Bypass static files
        if (byPassUrl) {
            status += ',BypassURL,';
            console.log(status + " : " + request.url);
            bypassCache = true;
        } else {
            // Check to see if the response needs to be bypassed because of a cookie
            bypassCache = context.bypassCookies; //|| shouldBypassEdgeCache(request, null);
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
            if (context["CDN-delete"]) {
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

            if (!deleted) {
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
                if (needsRevalidate) {
                    cachedResponse.headers.set('stale-version', (cacheVer - 1).toString());
                }
                if (R2StaleUsed) {
                    cachedResponse.headers.set('r2-stale', "true");
                    context['r2-stale'] = true;
                }
                if (!R2StaleUsed && needsRevalidate) {
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
    if (typeof KV !== 'undefined') {
        // Purge the KV cache by bumping the version number
        cacheVer = await getCurrentCacheVersion(cacheVer);
        cacheVer++;
        event.waitUntil(KV.put('html_cache_version', cacheVer.toString()));
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

    // We need duplicate this logic when invalidating the cache 
    if (ENABLE_ESI_BLOCKS) {
        let newBody = await processESI(response, null);
        response = new Response(newBody, response);
    }
    if (PWA_ENABLED) {
        let newBody = await processManifesto(response, null);
        response = new Response(newBody, response);
    }

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

            let cachePromise = await cache.put(cacheKeyRequest, cdnCachedResponse);
            status += ",Saved CDN,";
            context.version = cacheVer.toString();

            // Wait for cache Promise
            //await Promise.resolve(cachePromise);
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

/**
 * Response check cache-control headers
 * 
 * @param {Response} response 
 * @returns bool
 */
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
    if (HTML_CACHE_VERSION !== false) {
        return cacheVer = HTML_CACHE_VERSION;
    } else if (typeof KV === 'undefined') {
        return cacheVer = 1;
    }
    if (cacheVer === null) {
        if (typeof KV !== 'undefined') {
            cacheVer = await KV.get('html_cache_version', { cacheTtl: 60 });
            if (isNaN(cacheVer) || cacheVer === null || cacheVer > 1000 || cacheVer === "") {
                // 1000 is overflow protection
                // Uninitialized - first time through, initialize KV with a value
                // Blocking but should only happen immediately after worker activation.
                cacheVer = 0;
                await KV.put('html_cache_version', cacheVer.toString());
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

/**
 * Normalize url 
 * @param {url} url - original url
 * @returns 
 */
function normalizeUrl(url) {
    if (ALLOWED_GET_ONLY) {
        for (var key of url.searchParams.keys()) {
            if (!ALLOWED_GET.includes(key))
                url.searchParams.delete(key);
        }
    } else {
        for (var filter of FILTER_GET) {
            url.searchParams.delete(filter);
        }
    }
    return url;
}

/**
 * ESI(Edge Side Include) tags processing 
 * 
 * @param {Response} response - Response with ESI tags
 * @param {object} context - app context object
 * @returns 
 */
async function processESI(response, context) {
    // ESI tags is space and case sensitive 
    const regex = /<esi:include\s*src="(?<src>.*)"\s*(?:ttl="(?<ttl>\d*)")\/>/gm;
    let responseText = await response.text();
    responseText = responseText;
    let matches = null;
    let esiTags = [];

    while ((matches = regex.exec(responseText)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (matches.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        esiTags.push({ matches: matches.groups, source: matches[0] });
        matches.forEach((match, groupIndex) => {
            console.log(`Found match, group ${groupIndex}: ${match}`);
        });
    }
    console.log('Matches:');
    console.log(esiTags);
    let subRequest = [];
    esiTags.forEach(match => {
        subRequest.push(fetch(match.matches.src));
    });
    let results = await Promise.all(subRequest);

    results.forEach(async (result, ind) => {
        console.log(esiTags[ind].source);
        if (result.status === 200) {
            responseText = responseText.replace(esiTags[ind].source, await result.text());
        } else {
            responseText = responseText.replace(esiTags[ind].source, "<!--ESI not 200-->");
        }
    });
    //console.log(responseText);
    return responseText;
}

/**
 * Add manifesto to the responso 
 * 
 * @param {Response} response - responese to add manifest to
 * @param {object} context 
 * @returns {Promise<string>}
 */
async function processManifesto(response, context) {
    // ESI tags is space and case sensitive 
    const title = "</title>";
    let responseText = await response.text();
    responseText = responseText.replace(title, "</title><link rel=\"manifest\" href=\"/cf/manifesto.json?v=" + PWA_SPECULATION_VERSION + "\" />");

    //console.log(responseText);
    return responseText;
}

/**
* Get config value if it is set in the Variables and Secrets worker settings tab 
* @param {String} variableName - Name of the variables in the Variables and Secrets worker section
* @param {any} defaultValue - default value
* @param {String} type - JS variable type 
* @returns {any}
*/
function getConfigValue(variableName, defaultValue = true, type = 'bool') {
    let configValue = this[variableName];
    KV_CONFIG_CHECK[variableName] = variableName;
    let value = null;
    let status = 'default';

    if (KV_CONFIG_ENABLED && typeof KV_CONFIG[variableName] !== 'undefined' && KV_CONFIG[variableName] !== null) {
        value = KV_CONFIG[variableName];
    } else if (typeof configValue === 'undefined') {
        value = defaultValue;
    } else {
        status = 'config';
        console.log(configValue);
        switch (type) {
            case 'bool':
                if (configValue === "false") {
                    value = false;
                } else {
                    value = true;
                }
                break
            case 'string':
            case 'str':
                value = configValue;
                break;
            case 'integer':
            case 'int':
                value = parseInt(configValue);
                break
            case 'float':
                value = parseFloat(configValue);
                break
            case 'object':
            case 'obj':
                if (typeof configValue === "string") {
                    value = JSON.parse(configValue);
                } else if (typeof configValue === "object") {
                    value = configValue;
                }
                break
            case 'array':
                value = JSON.parse(configValue);
                break
            default:
                value = defaultValue;
        }
    }
    console.log(value);
    console.log("Config[" + status + "]: " + variableName + " = " + String(value));
    return value;
}

/**
 * Read init variables from the Worker Settings env vars "Variables & Secrets"
 */
function processConfig() {

    if (KV_CONFIG_ENABLED) {
        if (KV_CONFIG_LAST_SYNC === null) {
            KV_CONFIG_LAST_SYNC = Date.now();
        }
        if ((Date.now() - KV_CONFIG_LAST_SYNC) === 360) {
            //event.waitUntil(syncKvConfig());
            KV_CONFIG_LAST_SYNC = Date.now();
        }
    }

    // We need to add ENV_ to the variables or the value will be global, and no way to refresh it from the CF Admin without redeployment
    // Worker Variable name should be !== name of the variable from the config
    // To see the changes, you need to redeploy unfortunately 
    DEBUG = getConfigValue("ENV_DEBUG", true);

    CUSTOM_SPECULATION = getConfigValue("ENV_CUSTOM_SPECULATION", {
        'prerender': [{ //prerender - on click (doesn't work togather with prefetch)
            'source': 'document',
            //"relative_to": "document",
            'where': {
                'and': [
                    { 'href_matches': '/*' },
                    { 'not': { 'selector_matches': ['.action', '.skip-prerender', '.skip-prefetch'] } },
                    { 'not': { 'selector_matches': '[rel~=nofollow]' } },
                    {
                        'not': {
                            'href_matches': [
                                'checkout',
                                'customer',
                                'search',
                                'catalogsearch',
                                'product_compare',
                                'wishlist'
                            ]
                        }
                    }
                ]
            },
            // Moderate is the best other one generate too much traffic on worker. and could increase $
            'eagerness': 'conservative' // moderate, eager
        }],
        'prefetch': [{ //prerender - is not recommended
            'source': 'document',
            //"relative_to": "document",
            'where': {
                'and': [
                    { 'href_matches': '/*' },
                    { 'not': { 'selector_matches': ['.action', '.skip-prerender', '.skip-prefetch'] } },
                    { 'not': { 'selector_matches': '[rel~=nofollow]' } },
                    {
                        'not': {
                            'href_matches': [
                                'checkout',
                                'customer',
                                'search',
                                'catalogsearch',
                                'product_compare',
                                'wishlist'
                            ]
                        }
                    }
                ]
            },
            // Moderate is the best other one generate too much traffic on worker. and could increase $
            'eagerness': 'moderate' // moderate, eager
        }]
    }, 'obj');

    SPECULATION_ENABLED = getConfigValue("ENV_SPECULATION_ENABLED");

    TEST = getConfigValue("ENV_TEST", "test", 'str');

    SPECULATION_CACHED_ONLY = getConfigValue("ENV_SPECULATION_CACHED_ONLY");

    ENABLE_ESI_BLOCKS = getConfigValue("ENV_ENABLE_ESI_BLOCKS", ENABLE_ESI_BLOCKS);

    // Prevent any cache invalidations - 100% static 
    GOD_MOD = getConfigValue("ENV_GOD_MOD", false);

    FILTER_GET = getConfigValue("ENV_FILTER_GET", FILTER_GET, 'array');

    R2_STALE = getConfigValue("ENV_R2_STALE", R2_STALE);

    ADMIN_URL = getConfigValue("ENV_ADMIN_URL", 'admin', 'str');
    BYPASS_URL.push(ADMIN_URL);

    // Revalidate the cache every N secs
    // User will receive old/stale version
    REVALIDATE_AGE = getConfigValue("ENV_REVALIDATE_AGE", 360, 'int');

    CUSTOM_CORS = getConfigValue("ENV_CUSTOM_CORS", [], 'array');
    ALLOWED_GET = getConfigValue("ENV_ALLOWED_GET", ALLOWED_GET, 'array');
    ALLOWED_GET_ONLY = getConfigValue("ENV_ALLOWED_GET_ONLY", ALLOWED_GET_ONLY);

    PWA_ENABLED = getConfigValue("ENV_PWA_ENABLED", PWA_ENABLED);

    CUSTOM_PRELOAD = getConfigValue("ENV_CUSTOM_PRELOAD", [
        "<https://fonts.gstatic.com>; rel=preconnect",
        //Link: </style.css>; rel=preload; as=style
        //Link: </script.js>; rel=preload; as=script
    ],
        'array');

    HTML_CACHE_VERSION = getConfigValue("ENV_HTML_CACHE_VERSION", HTML_CACHE_VERSION, 'int');
    PWA_SPECULATION_VERSION = getConfigValue("ENV_PWA_SPECULATION_VERSION", PWA_SPECULATION_VERSION, 'int');
    PWA_MANIFEST = getConfigValue("ENV_PWA_MANIFEST", PWA_MANIFEST,
        'obj');

    // set config by single Json file ENV_JSON_CONFIG {json} varriable 
    // single ENV varrable has priority 
    getENVConfigJson();

}

/**
 * Sync Config from the KV storage
 */
async function syncKvConfig() {
    try {
        Object.keys(KV_CONFIG_CHECK).forEach(async (confName) => {
            KV_CONFIG[confName] = await KV.get(confName);
        });
    } catch (error) {
        console.log(error);
    }
}

async function getENVConfigJson() {
    JSON_CONFIG = getConfigValue("ENV_JSON_CONFIG", JSON_CONFIG, 'obj');
    if (Object.keys(JSON_CONFIG).length === 0) {
        return false;
    }
    for (const [key, value] of Object.entries(JSON_CONFIG)) {
        console.log(`ENV CONF JSON: ${key}: ${value}`);
        //Checking if ENV variable are set. It has priority
        if (typeof this["ENV_" + key] === "undefined") {
            this[key] = value;
        }
    }
    return true;
}

/**
 * Fetch request and modify headers
 * event.respondWith expects async function or promise that's why just passing value doesn't work 
 * 
 * @param {Request} request - request to fetch
 * @param {Array} headers - headers will be added to the response
 * @returns Response
 */
async function fetchAndModifyHeaders(request, headers = []) {
    let resp = await fetch(new Request(request));
    let newResp = new Response(resp.body, resp);
    for (let header of headers) {
        newResp.headers.set(header.name, header.value);
    }
    return newResp;
}

/**
 * Hash
 * 
 * @param {String} string - string to hash
 * @param {*} context
 * @returns 
 */
async function hash(string, context) {
    // Magento captcha issue fixed
    /*const time = new Date();
    let intTime = parseInt(time.getTime() / 10000000000);
    let re = new RegExp(intTime + '.{5,25}', "g");
    let form_key = getCookie(context.cookies, FORM_KEY);

    string  = string.replace(re, '-*-*-*-*-1');
    string  = string.replaceAll(context.url.search, '-*-*-*-*-2');
    if (form_key !== "") {
       string  = string.replaceAll(form_key, '-*-*-*-*-3');
    }*/

    //console.log(string);
    let text = new TextEncoder().encode(string);
    const digest = await crypto.subtle.digest({ name: 'SHA-1' }, text);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get cookies by name
 * 
 * @param {String} cookies - cookies header string
 * @param {String} name - name
 * @returns String || null
 */
function getCookie(cookies, name) {
    name = name + "=";
    let decodedCookie = decodeURIComponent(cookies);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return null;
}
