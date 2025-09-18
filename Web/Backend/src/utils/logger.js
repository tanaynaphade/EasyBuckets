const winston = require('winston');
const path = require('path');
const config = require('../config/environment');

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Define log colors
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
};

winston.addColors(logColors);

// Create logger
const logger = winston.createLogger({
    level: config.LOGGING.LEVEL,
    levels: logLevels,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: {
        service: 'nba-analytics-backend',
        version: '1.0.0',
        environment: config.NODE_ENV
    },
    transports: [
        // Error logs
        new winston.transports.File({
            filename: path.join(config.LOGGING.FILE_PATH, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // Combined logs
        new winston.transports.File({
            filename: path.join(config.LOGGING.FILE_PATH, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ],

    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(config.LOGGING.FILE_PATH, 'exceptions.log')
        })
    ],

    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(config.LOGGING.FILE_PATH, 'rejections.log')
        })
    ]
});

// Add console transport for non-production environments
if (!config.isProduction()) {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.simple(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
                let logMessage = `${timestamp} [${level}]: ${message}`;

                // Add metadata if present
                if (Object.keys(meta).length > 0) {
                    logMessage += `\n${JSON.stringify(meta, null, 2)}`;
                }

                return logMessage;
            })
        )
    }));
}

// Create a stream for Morgan HTTP logging
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    }
};

// Helper methods for structured logging
logger.logError = (error, context = {}) => {
    logger.error(error.message || error, {
        stack: error.stack,
        ...context
    });
};

logger.logUserAction = (userId, action, details = {}) => {
    logger.info(`User action: ${action}`, {
        userId,
        action,
        ...details
    });
};

logger.logSecurityEvent = (event, details = {}) => {
    logger.warn(`Security event: ${event}`, {
        event,
        timestamp: new Date().toISOString(),
        ...details
    });
};

logger.logDatabaseEvent = (operation, collection, details = {}) => {
    logger.info(`Database ${operation} on ${collection}`, {
        operation,
        collection,
        ...details
    });
};

logger.logApiRequest = (req, responseTime, statusCode) => {
    logger.http(`${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseTime,
        statusCode,
        userId: req.user?.id
    });
};

module.exports = logger;
