/**
 * CloudFlare FPC Worker - Modular Version
 * Full Page Cache worker with improved architecture
 */

import { getConfigManager } from './src/config/ConfigManager.js';
import { CacheManager } from './src/cache/CacheManager.js';
import { ResponseProcessor } from './src/processors/ResponseProcessor.js';
import { RequestHandler } from './src/RequestHandler.js';

/**
 * Initialize worker components
 */
function initializeWorker() {
    // Get configuration manager
    const config = getConfigManager();

    // Create cache manager
    const cacheManager = new CacheManager(config);
    
    // Set up KV and R2 if available
    if (typeof KV !== 'undefined') {
        cacheManager.setKVNamespace(KV);
    }
    
    if (typeof R2 !== 'undefined') {
        cacheManager.setR2Bucket(R2);
    }

    // Create response processor
    const responseProcessor = new ResponseProcessor(config);

    // Create request handler
    const requestHandler = new RequestHandler(config, cacheManager, responseProcessor);

    return requestHandler;
}

// Initialize worker
const requestHandler = initializeWorker();

/**
 * Main worker entry point
 */
addEventListener("fetch", event => {
    event.respondWith(handleRequest(event));
});

/**
 * Handle incoming requests
 * @param {FetchEvent} event - Fetch event
 * @returns {Promise<Response>} Response
 */
async function handleRequest(event) {
    try {
        return await requestHandler.handleRequest(event.request, event);
    } catch (error) {
        console.error('Worker error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
