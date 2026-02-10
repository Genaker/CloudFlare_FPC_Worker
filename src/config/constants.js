/**
 * Configuration Constants for CloudFlare FPC Worker
 * Centralized configuration management
 */

// Cache Control Settings
export const CACHE_CONTROL_NO_CACHE = [
    'no-cache',
    'no-store'
];

// Cache Status Codes
export const CACHE_STATUSES = [
    200,
    301,
    //302, Bots create a lot of redirects of this type. 
    //404
];

// Default cookie prefixes for logged-in users
export const VERSION_COOKIES = [
    "X-Magento-Vary"
];

// Default cookie prefixes for bypass
export const DEFAULT_BYPASS_COOKIES = [
    'admin'
];

// User cookies for R2 cache
export const USER_COOKIES = [
    'X-Magento-Vary'
];

// Form key constant
export const FORM_KEY = 'form_key';

// Content Security Policy Report-Only Header
export const CSPRO_HEADER = 'content-security-policy-report-only';

// Accept Content Header
export const ACCEPT_CONTENT_HEADER = 'Accept';

// Filtered GET parameters (tracking, analytics, etc.)
export const FILTER_GET = [
    // Facebook related
    'fbclid', 'fb_ad', 'fb_adid', 'fb_adset', 'fb_campaign',
    'fb_adsetid', 'fb_campaignid', 'utm_id', 'utm_source',
    'matchtype', 'addisttype', 'adposition', 'gad_source',
    'utm_term', 'utm_medium', 'utm_cam', 'utm_campaign',
    'utm_content', 'utm_creative', 'utm_adcontent', 'utm_adgroupid',
    'wbraid', 'epik', '_hsenc', '_hsmi', '__hstc',
    'affiliate_code', 'referring_service', 'hsa_cam',
    'hsa_acc', 'msclkid', 'hsa_grp', 'hsa_ad',
    'hsa_src', 'hsa_net', 'hsa_ver', 'dm_i', 'dm_t',
    'ref', 'trk', 'uuid', 'dicbo', 'adgroupid',
    
    // Google related
    'g_keywordid', 'g_keyword', 'g_campaignid', 'g_campaign',
    'g_network', 'g_adgroupid', 'g_adtype', 'g_acctid',
    'g_adid', 'cq_plac', 'cq_net', 'cq_pos', 'cq_med',
    'cq_plt', 'b_adgroup', 'b_adgroupid', 'b_adid',
    'b_campaign', 'b_campaignid', 'b_isproduct', 'b_productid',
    'b_term', 'b_termid', 'msclkid', 'gbraid', 'gclid',
    'gclsrc', 'customer-service', 'terms-of-service',
    '_ga', '_gl', 'add', 'srsltid',
    
    // Worker specific
    'click', 'gtm_debug', 'cf-cdn', 'r2-cdn',
    'cf-delete', 'cf-ttl', 'cf-revalidate'
];

// Whitelisted GET parameters
export const ALLOWED_GET = [
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

// URLs that will not be cached
export const BYPASS_URL = [
    'order', 'onestepcheckout', 'admin', 'checkout',
    'catalogsearch', 'paypal', 'cart', 'static/',
    'media/', 'api', 'rest/', 'ajax', 'frontend_action',
    'searchspring', 'customer', 'compare', 'tracking',
    'account', 'feedonomics', 'estimateddeliverydate',
    'original-page', 'connector/email', 'wp-content/uploads'
];

// URLs that will always be cached
export const CACHE_ALWAYS = [
    'customer-service',
    'banner/ajax/load'
];

// Minimum body size for caching (3KB)
export const BODY_MIN_SIZE = 3 * 1024;

// PWA Configuration
export const PWA_IMAGE = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IS0tIFVwbG9hZGVkIHRvOiBTVkcgUmVwbywgd3d3LnN2Z3JlcG8uY29tLCBHZW5lcmF0b3I6IFNWRyBSZXBvIE1peGVyIFRvb2xzIC0tPgo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKYXJpYS1sYWJlbD0iQ2xvdWRmbGFyZSIgcm9sZT0iaW1nIgp2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PHJlY3QKd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiCnJ4PSIxNSUiCmZpbGw9IiNmZmZmZmYiLz48cGF0aCBmaWxsPSIjZjM4MDIwIiBkPSJNMzMxIDMyNmMxMS0yNi00LTM4LTE5LTM4bC0xNDgtMmMtNCAwLTQtNiAxLTdsMTUwLTJjMTctMSAzNy0xNSA0My0zMyAwIDAgMTAtMjEgOS0yNGE5NyA5NyAwIDAgMC0xODctMTFjLTM4LTI1LTc4IDktNjkgNDYtNDggMy02NSA0Ni02MCA3MiAwIDEgMSAyIDMgMmgyNzRjMSAwIDMtMSAzLTN6Ii8+PHBhdGggZmlsbD0iI2ZhYWU0MCIgZD0iTTM4MSAyMjRjLTQgMC02LTEtNyAxbC01IDIxYy01IDE2IDMgMzAgMjAgMzFsMzIgMmM0IDAgNCA2LTEgN2wtMzMgMWMtMzYgNC00NiAzOS00NiAzOSAwIDIgMCAzIDIgM2gxMTNsMy0yYTgxIDgxIDAgMCAwLTc4LTEwMyIvPjwvc3ZnPg==";

export const PWA_MANIFEST = {
    "theme_color": "#ffffff",
    "background_color": "#ffffff",
    "icons": [{ "sizes": "any", "src": PWA_IMAGE, "type": "image/svg+xml" }],
    "orientation": "any",
    "display": "standalone",
    "dir": "auto",
    "lang": "en-US",
    "id": "https://your-domain.com/",
    "start_url": "/",
    "scope": "https://your-domain.com/",
    "description": "Cloud Flare Magento PWA",
    "name": "Magento PWA",
    "short_name": "M2 PWA",
    "prefer_related_applications": false
};

// Default Speculation Rules Configuration
export const DEFAULT_SPECULATION = {
    'prerender': [{
        'source': 'document',
        'where': {
            'and': [
                { 'href_matches': '/*' },
                { 'not': { 'selector_matches': ['.action', '.skip-prerender', '.skip-prefetch'] } },
                { 'not': { 'selector_matches': '[rel~=nofollow]' } },
                {
                    'not': {
                        'href_matches': [
                            'checkout', 'customer', 'search',
                            'catalogsearch', 'product_compare', 'wishlist'
                        ]
                    }
                }
            ]
        },
        'eagerness': 'moderate'
    }]
};
