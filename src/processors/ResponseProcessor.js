/**
 * Response Processor
 * Handles response modifications like ESI, PWA manifest, and speculation rules
 */

/**
 * ResponseProcessor class for handling response modifications
 */
export class ResponseProcessor {
    constructor(config) {
        this.config = config;
    }

    /**
     * Process response and add enhancements
     * @param {Response} response - Original response
     * @param {object} context - Request context
     * @returns {Promise<Response>} Processed response
     */
    async processResponse(response, context) {
        let processedResponse = response;

        // Process ESI blocks if enabled
        if (this.config.isEnabled('enableESIBlocks')) {
            processedResponse = await this.processESI(processedResponse, context);
        }

        // Process PWA manifest
        if (this.config.isEnabled('pwaEnabled')) {
            processedResponse = await this.processManifest(processedResponse, context);
        }

        // Process speculation rules
        if (this.config.isEnabled('speculationEnabled')) {
            processedResponse = await this.processSpeculation(processedResponse, context);
        }

        return processedResponse;
    }

    /**
     * Process ESI (Edge Side Includes) blocks
     * @param {Response} response - Response object
     * @param {object} context - Request context
     * @returns {Promise<Response>} Response with ESI processed
     */
    async processESI(response, context) {
        const contentType = response.headers.get('Content-Type') || '';
        
        if (!contentType.includes('text/html')) {
            return response;
        }

        try {
            let html = await response.text();
            
            // Find and process ESI tags: <!--esi <esi:include src="..." /> -->
            const esiPattern = /<!--esi\s*<esi:include\s+src="([^"]+)"\s*\/>\s*-->/g;
            
            const esiPromises = [];
            const esiMatches = [];
            let match;
            
            while ((match = esiPattern.exec(html)) !== null) {
                esiMatches.push({
                    fullMatch: match[0],
                    url: match[1]
                });
            }

            // Fetch ESI content
            for (const esiMatch of esiMatches) {
                const promise = fetch(esiMatch.url, {
                    headers: {
                        'Cookie': context.cookies || ''
                    }
                }).then(res => res.text())
                  .catch(() => '<!-- ESI Error -->');
                
                esiPromises.push(promise);
            }

            const esiResults = await Promise.all(esiPromises);

            // Replace ESI tags with fetched content
            for (let i = 0; i < esiMatches.length; i++) {
                html = html.replace(esiMatches[i].fullMatch, esiResults[i]);
            }

            return new Response(html, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        } catch (error) {
            console.error('Error processing ESI:', error);
            return response;
        }
    }

    /**
     * Process and inject PWA manifest
     * @param {Response} response - Response object
     * @param {object} context - Request context
     * @returns {Promise<Response>} Response with manifest injected
     */
    async processManifest(response, context) {
        const contentType = response.headers.get('Content-Type') || '';
        
        if (!contentType.includes('text/html')) {
            return response;
        }

        try {
            let html = await response.text();
            
            // Get PWA manifest
            let manifest = this.config.get('pwaManifest');
            
            if (!manifest) {
                // Use default manifest with current origin
                const url = new URL(context.url);
                manifest = {
                    "theme_color": "#ffffff",
                    "background_color": "#ffffff",
                    "display": "standalone",
                    "scope": url.origin,
                    "start_url": "/",
                    "name": "PWA App",
                    "short_name": "PWA"
                };
            }

            const manifestJson = JSON.stringify(manifest);
            const manifestDataUri = `data:application/json;base64,${btoa(manifestJson)}`;

            // Inject manifest link if not present
            if (!html.includes('rel="manifest"')) {
                const manifestLink = `<link rel="manifest" href="${manifestDataUri}">`;
                html = html.replace('</head>', `${manifestLink}\n</head>`);
            }

            return new Response(html, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        } catch (error) {
            console.error('Error processing manifest:', error);
            return response;
        }
    }

    /**
     * Process and inject speculation rules
     * @param {Response} response - Response object
     * @param {object} context - Request context
     * @returns {Promise<Response>} Response with speculation rules
     */
    async processSpeculation(response, context) {
        const contentType = response.headers.get('Content-Type') || '';
        
        if (!contentType.includes('text/html')) {
            return response;
        }

        try {
            let html = await response.text();
            
            // Get speculation rules
            const customSpeculation = this.config.get('customSpeculation');
            
            if (!customSpeculation) {
                return response;
            }

            const speculationJson = JSON.stringify(customSpeculation);
            const speculationScript = `<script type="speculationrules">${speculationJson}</script>`;

            // Inject speculation rules before </body>
            if (!html.includes('type="speculationrules"')) {
                html = html.replace('</body>', `${speculationScript}\n</body>`);
            }

            return new Response(html, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        } catch (error) {
            console.error('Error processing speculation:', error);
            return response;
        }
    }

    /**
     * Add custom headers to response
     * @param {Response} response - Response object
     * @param {object} headers - Headers to add
     * @returns {Response} Response with added headers
     */
    addHeaders(response, headers) {
        const newResponse = new Response(response.body, response);
        
        for (const [name, value] of Object.entries(headers)) {
            newResponse.headers.set(name, value);
        }

        return newResponse;
    }

    /**
     * Check body size
     * @param {Response} response - Response to check
     * @param {number} limitInKBytes - Minimum size limit in KB
     * @returns {Promise<boolean>} True if body size meets minimum
     */
    async checkBodySize(response, limitInKBytes) {
        try {
            const blob = await response.blob();
            const sizeInKBytes = blob.size / 1024;
            return sizeInKBytes >= limitInKBytes;
        } catch (error) {
            console.error('Error checking body size:', error);
            return false;
        }
    }
}
