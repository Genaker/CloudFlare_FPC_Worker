/**
 * Logger Utility
 * Structured logging with different levels
 */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

/**
 * Logger class for structured logging
 */
export class Logger {
    constructor(config) {
        this.config = config;
        this.level = LOG_LEVELS.INFO;
        
        if (config && config.isEnabled && config.isEnabled('debug')) {
            this.level = LOG_LEVELS.DEBUG;
        }
    }

    /**
     * Set log level
     * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
     */
    setLevel(level) {
        if (LOG_LEVELS[level] !== undefined) {
            this.level = LOG_LEVELS[level];
        }
    }

    /**
     * Log error message
     * @param {string} message - Error message
     * @param {any} data - Additional data
     */
    error(message, data = null) {
        if (this.level >= LOG_LEVELS.ERROR) {
            console.error(`[ERROR] ${message}`, data || '');
        }
    }

    /**
     * Log warning message
     * @param {string} message - Warning message
     * @param {any} data - Additional data
     */
    warn(message, data = null) {
        if (this.level >= LOG_LEVELS.WARN) {
            console.warn(`[WARN] ${message}`, data || '');
        }
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {any} data - Additional data
     */
    info(message, data = null) {
        if (this.level >= LOG_LEVELS.INFO) {
            console.log(`[INFO] ${message}`, data || '');
        }
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {any} data - Additional data
     */
    debug(message, data = null) {
        if (this.level >= LOG_LEVELS.DEBUG) {
            console.log(`[DEBUG] ${message}`, data || '');
        }
    }

    /**
     * Log timing information
     * @param {string} label - Timing label
     * @param {number} startTime - Start time in ms
     * @param {number} endTime - End time in ms
     */
    timing(label, startTime, endTime) {
        const duration = endTime - startTime;
        this.debug(`${label}: ${duration}ms`);
    }
}

/**
 * Create logger instance
 * @param {object} config - Configuration object
 * @returns {Logger} Logger instance
 */
export function createLogger(config) {
    return new Logger(config);
}
