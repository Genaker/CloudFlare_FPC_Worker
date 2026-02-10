/**
 * Configuration Manager
 * Handles environment variables and KV-based configuration
 */

/**
 * Configuration Manager for CloudFlare Worker
 */
export class ConfigManager {
    constructor() {
        this.kvConfigEnabled = false;
        this.kvConfigLastSync = null;
        this.kvConfig = {};
        this.kvConfigCheck = {};
        this.config = {};
        this.initialized = false;
    }

    /**
     * Initialize configuration from environment variables
     */
    initialize() {
        if (this.initialized) {
            return;
        }

        // Load configuration from environment variables
        this.config = {
            // Feature Flags
            debug: this.getConfigValue("ENV_DEBUG", true),
            godMod: this.getConfigValue("ENV_GOD_MOD", false),
            test: this.getConfigValue("ENV_TEST", false),
            mobileCacheDifferent: this.getConfigValue("ENV_MOBILECACHE_DIFFERENT", false),
            
            // Cache Settings
            revalidateAge: this.getConfigValue("ENV_REVALIDATE_AGE", 300, 'int'),
            htmlCacheVersion: this.getConfigValue("ENV_HTML_CACHE_VERSION", false, 'int'),
            
            // R2 Configuration
            r2Stale: this.getConfigValue("ENV_R2_STALE", true),
            r2ServerRace: this.getConfigValue("ENV_R2_SERVER_RACE", true),
            r2CacheLoggedInUsers: this.getConfigValue("ENV_R2_CACHE_LOGGEDIN_USERS", false),
            
            // Feature Settings
            enableESIBlocks: this.getConfigValue("ENV_ENABLE_ESI_BLOCKS", false),
            csprRemove: this.getConfigValue("ENV_CSPRO_REMOVE", true),
            allowedGetOnly: this.getConfigValue("ENV_ALLOWED_GET_ONLY", false),
            
            // PWA Configuration
            pwaEnabled: this.getConfigValue("ENV_PWA_ENABLED", true),
            pwaSpeculationVersion: this.getConfigValue("ENV_PWA_SPECULATION_VERSION", 1, 'int'),
            pwaManifest: this.getConfigValue("ENV_PWA_MANIFEST", null, 'object'),
            
            // Speculation Rules
            speculationEnabled: this.getConfigValue("ENV_SPECULATION_ENABLED", true),
            speculationCachedOnly: this.getConfigValue("ENV_SPECULATION_CACHED_ONLY", true),
            customSpeculation: this.getConfigValue("ENV_CUSTOM_SPECULATION", null, 'object'),
            
            // CORS and Headers
            customCors: this.getConfigValue("ENV_CUSTOM_CORS", null, 'object'),
            customPreload: this.getConfigValue("ENV_CUSTOM_PRELOAD", null, 'string'),
            
            // Admin Settings
            adminUrl: this.getConfigValue("ENV_ADMIN_URL", null, 'string'),
            
            // CloudFlare API (if not using KV)
            cloudflareApi: {
                email: this.getConfigValue("ENV_CLOUDFLARE_EMAIL", "", 'string'),
                key: this.getConfigValue("ENV_CLOUDFLARE_KEY", "", 'string'),
                zone: this.getConfigValue("ENV_CLOUDFLARE_ZONE", "", 'string')
            }
        };

        this.initialized = true;
    }

    /**
     * Get configuration value from environment or KV
     * @param {string} variableName - Name of the variable
     * @param {any} defaultValue - Default value if not found
     * @param {string} type - Type of the variable ('bool', 'string', 'int', 'float', 'object', 'array')
     * @returns {any} Configuration value
     */
    getConfigValue(variableName, defaultValue = true, type = 'bool') {
        let configValue = this[variableName] || globalThis[variableName];
        this.kvConfigCheck[variableName] = variableName;
        let value = null;
        let status = 'default';

        // Check KV config first
        if (this.kvConfigEnabled && 
            typeof this.kvConfig[variableName] !== 'undefined' && 
            this.kvConfig[variableName] !== null) {
            value = this.kvConfig[variableName];
            status = 'kv';
        } else if (typeof configValue === 'undefined') {
            value = defaultValue;
        } else {
            status = 'env';
            value = this.parseConfigValue(configValue, type, defaultValue);
        }

        if (this.config.debug) {
            console.log(`Config[${status}]: ${variableName} = ${String(value)}`);
        }

        return value;
    }

    /**
     * Parse configuration value based on type
     * @param {any} configValue - Raw config value
     * @param {string} type - Expected type
     * @param {any} defaultValue - Default value
     * @returns {any} Parsed value
     */
    parseConfigValue(configValue, type, defaultValue) {
        try {
            switch (type) {
                case 'bool':
                    return configValue === "false" ? false : true;
                
                case 'string':
                case 'str':
                    return String(configValue);
                
                case 'integer':
                case 'int':
                    return parseInt(configValue);
                
                case 'float':
                    return parseFloat(configValue);
                
                case 'object':
                case 'obj':
                    if (typeof configValue === "string") {
                        return JSON.parse(configValue);
                    } else if (typeof configValue === "object") {
                        return configValue;
                    }
                    return defaultValue;
                
                case 'array':
                    return typeof configValue === "string" 
                        ? JSON.parse(configValue) 
                        : configValue;
                
                default:
                    return defaultValue;
            }
        } catch (error) {
            console.error(`Error parsing config ${type}:`, error);
            return defaultValue;
        }
    }

    /**
     * Get a configuration value
     * @param {string} key - Configuration key
     * @param {any} defaultValue - Default value if not found
     * @returns {any} Configuration value
     */
    get(key, defaultValue = null) {
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }

    /**
     * Check if a feature is enabled
     * @param {string} feature - Feature name
     * @returns {boolean} True if enabled
     */
    isEnabled(feature) {
        return this.config[feature] === true;
    }

    /**
     * Get all configuration
     * @returns {object} All configuration values
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Sync configuration from KV storage
     * @param {KVNamespace} kv - KV namespace
     */
    async syncKvConfig(kv) {
        if (!this.kvConfigEnabled) {
            return;
        }

        try {
            const configJson = await kv.get('config_json');
            if (configJson) {
                this.kvConfig = JSON.parse(configJson);
                this.kvConfigLastSync = Date.now();
            }
        } catch (error) {
            console.error('Error syncing KV config:', error);
        }
    }
}

// Singleton instance
let configManagerInstance = null;

/**
 * Get singleton ConfigManager instance
 * @returns {ConfigManager}
 */
export function getConfigManager() {
    if (!configManagerInstance) {
        configManagerInstance = new ConfigManager();
        configManagerInstance.initialize();
    }
    return configManagerInstance;
}
