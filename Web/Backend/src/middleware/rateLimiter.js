const rateLimit = require('express-rate-limit');
const config = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Create a custom rate limiter (UPDATED - Fixed deprecation warnings)
 */
const createLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: config.SECURITY.RATE_LIMIT_WINDOW_MS,
        max: config.SECURITY.RATE_LIMIT_MAX_REQUESTS,
        message: {
            error: 'Too many requests from this IP',
            message: 'Please try again later',
            retryAfter: Math.ceil(config.SECURITY.RATE_LIMIT_WINDOW_MS / 1000 / 60) // minutes
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use forwarded IP if behind proxy, otherwise use connection IP
            return req.ip || req.connection.remoteAddress;
        },
        handler: (req, res) => {
            logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
            res.status(429).json({
                success: false,
                error: options.message || 'Too many requests',
                retryAfter: Math.round(req.rateLimit.resetTime / 1000)
            });
        },
        // REMOVED: onLimitReached (deprecated in v7)
        // Use skip function instead for logging
        skip: (req, res) => {
            // Log when limit is about to be reached
            if (req.rateLimit && req.rateLimit.remaining <= 1) {
                logger.warn(`Rate limit about to be reached for IP: ${req.ip}, endpoint: ${req.originalUrl}`);
            }
            return false; // Don't skip any requests
        }
    };

    return rateLimit({ ...defaultOptions, ...options });
};

/**
 * General API rate limiter - 100 requests per 15 minutes
 */
const generalLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        error: 'Too many API requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        retryAfter: 15
    }
});

/**
 * Strict rate limiter for authentication endpoints - 5 requests per 15 minutes
 */
const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: {
        error: 'Too many authentication attempts',
        message: 'Too many login attempts. Please try again later.',
        retryAfter: 15
    },
    skipSuccessfulRequests: true // Don't count successful requests
});

/**
 * Registration rate limiter - 3 registrations per hour per IP
 */
const registrationLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: {
        error: 'Too many registration attempts',
        message: 'Maximum registrations per hour exceeded. Please try again later.',
        retryAfter: 60
    }
});

/**
 * Password reset limiter - 3 attempts per hour per IP
 */
const passwordResetLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: {
        error: 'Too many password reset requests',
        message: 'Too many password reset attempts. Please try again later.',
        retryAfter: 60
    }
});

/**
 * Donation submission limiter - 10 donations per hour per IP
 */
const donationLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: {
        error: 'Too many donation submissions',
        message: 'Maximum donations per hour exceeded. Please try again later.',
        retryAfter: 60
    }
});

/**
 * Testimonial submission limiter - 2 testimonials per hour per IP
 */
const testimonialLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2,
    message: {
        error: 'Too many testimonial submissions',
        message: 'Maximum testimonials per hour exceeded. Please try again later.',
        retryAfter: 60
    }
});

/**
 * Dynamic limiter based on user authentication status
 */
const dynamicLimiter = (authenticatedMax, unauthenticatedMax) => {
    return [
        createLimiter({
            max: unauthenticatedMax,
            skip: (req) => req.user !== undefined, // Skip if authenticated
            keyGenerator: (req) => req.ip
        }),
        createLimiter({
            max: authenticatedMax,
            skip: (req) => req.user === undefined, // Skip if not authenticated
            keyGenerator: (req) => req.user ? req.user._id.toString() : req.ip
        })
    ];
};

/**
 * Create user-specific rate limiter
 */
const createUserLimiter = (maxRequests, windowMs, message) => {
    return createLimiter({
        max: maxRequests,
        windowMs: windowMs,
        keyGenerator: (req) => {
            if (req.user) {
                return `user_${req.user._id.toString()}`;
            }
            return req.ip;
        },
        message: {
            error: 'User rate limit exceeded',
            message: message || 'You have made too many requests. Please slow down.',
            retryAfter: Math.ceil(windowMs / 1000 / 60)
        }
    });
};

module.exports = {
    generalLimiter,
    authLimiter,
    registrationLimiter,
    passwordResetLimiter,
    donationLimiter,
    testimonialLimiter,
    dynamicLimiter,
    createLimiter,
    createUserLimiter
};