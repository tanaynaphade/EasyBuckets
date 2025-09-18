const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const config = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Security headers middleware using Helmet
 */
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
        },
        reportOnly: !config.isProduction()
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

/**
 * CORS configuration
 */
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        const allowedOrigins = config.SECURITY.ALLOWED_ORIGINS;

        if (config.isDevelopment()) {
            // In development, allow all origins
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key'
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Current-Page'
    ]
};

/**
 * Compression middleware
 */
const compressionMiddleware = compression({
    filter: (req, res) => {
        // Don't compress responses if this request asks for an uncompressed response
        if (req.headers['x-no-compression']) {
            return false;
        }

        // Use compression for all other responses
        return compression.filter(req, res);
    },
    threshold: 1024, // Only compress responses larger than 1KB
    level: 6 // Compression level (1-9, 6 is default)
});

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log request
    logger.info(`📨 ${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type')
    });

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? 'error' : 'info';

        logger[level](`📤 ${res.statusCode} ${req.method} ${req.originalUrl} - ${duration}ms`, {
            statusCode: res.statusCode,
            duration,
            contentLength: res.get('Content-Length'),
            ip: req.ip
        });
    });

    next();
};

/**
 * IP tracking and security
 */
const ipSecurity = (req, res, next) => {
    // Get real IP address (handling proxies)
    const realIp = req.headers['x-forwarded-for'] || 
                   req.headers['x-real-ip'] || 
                   req.connection.remoteAddress ||
                   req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : null);

    req.clientIp = realIp;

    // Add IP to request object for easier access
    if (!req.ip && realIp) {
        req.ip = realIp.split(',')[0].trim(); // Take first IP if multiple
    }

    // Log suspicious activity
    if (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',').length > 3) {
        logger.warn('Suspicious request with multiple forwarded IPs:', {
            ip: req.ip,
            forwardedFor: req.headers['x-forwarded-for'],
            userAgent: req.get('User-Agent')
        });
    }

    next();
};

/**
 * Content type validation
 */
const validateContentType = (allowedTypes = ['application/json']) => {
    return (req, res, next) => {
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            const contentType = req.get('Content-Type');

            if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
                return res.status(415).json({
                    success: false,
                    error: 'Unsupported Media Type',
                    message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
                });
            }
        }
        next();
    };
};

/**
 * Request size limiter
 */
const requestSizeLimiter = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length']);
        const maxBytes = parseSize(maxSize);

        if (contentLength && contentLength > maxBytes) {
            return res.status(413).json({
                success: false,
                error: 'Request Too Large',
                message: `Request size exceeds ${maxSize} limit`
            });
        }

        next();
    };
};

/**
 * Helper function to parse size strings
 */
const parseSize = (size) => {
    const units = {
        'b': 1,
        'kb': 1024,
        'mb': 1024 * 1024,
        'gb': 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';

    return value * units[unit];
};

/**
 * API versioning middleware
 */
const apiVersioning = (req, res, next) => {
    const version = req.headers['api-version'] || req.query.v || '1.0';
    req.apiVersion = version;

    // Set version in response header
    res.set('API-Version', version);

    next();
};

/**
 * Request timeout middleware
 */
const requestTimeout = (timeout = 30000) => {
    return (req, res, next) => {
        req.setTimeout(timeout, () => {
            res.status(408).json({
                success: false,
                error: 'Request Timeout',
                message: 'Request took too long to process'
            });
        });
        next();
    };
};

module.exports = {
    securityHeaders,
    cors: cors(corsOptions),
    compression: compressionMiddleware,
    requestLogger,
    ipSecurity,
    validateContentType,
    requestSizeLimiter,
    apiVersioning,
    requestTimeout
};
