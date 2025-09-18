const jwtManager = require('../config/jwt');
const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return next(new AppError('Access token is required', 401));
        }

        const token = jwtManager.extractToken(authHeader);
        const decoded = jwtManager.verifyAccessToken(token);

        // Check if user still exists
        const user = await User.findById(decoded.id).select('+isActive');
        if (!user) {
            return next(new AppError('User no longer exists', 401));
        }

        // Check if user is active
        if (!user.isActive) {
            return next(new AppError('Account is deactivated', 401));
        }

        // Check if user is locked
        if (user.isLocked) {
            return next(new AppError('Account is temporarily locked', 423));
        }

        // Check if password was changed after token was issued
        const tokenIssuedAt = new Date(decoded.iat * 1000);
        if (user.passwordChangedAt && user.passwordChangedAt > tokenIssuedAt) {
            return next(new AppError('Password recently changed. Please log in again', 401));
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid token', 401));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Token has expired', 401));
        }
        logger.error('Authentication error:', error);
        return next(new AppError('Authentication failed', 401));
    }
};

/**
 * Optional authentication middleware
 * Attaches user if token is present but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            req.user = null;
            return next();
        }

        const token = jwtManager.extractToken(authHeader);
        const decoded = jwtManager.verifyAccessToken(token);

        const user = await User.findById(decoded.id).select('+isActive');
        if (user && user.isActive && !user.isLocked) {
            req.user = user;
        } else {
            req.user = null;
        }

        next();
    } catch (error) {
        // If token is invalid, just set user to null
        req.user = null;
        next();
    }
};

/**
 * Authorization middleware factory
 * Checks if user has required role
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        if (!roles.includes(req.user.role)) {
            logger.warn(`Unauthorized access attempt by user ${req.user.email} with role ${req.user.role}`);
            return next(new AppError('Insufficient permissions', 403));
        }

        next();
    };
};

/**
 * Middleware to check if user owns the resource
 * Compares req.user.id with req.params.userId or resource owner
 */
const checkOwnership = (resourcePath = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }

        const resourceOwnerId = req.params[resourcePath] || req.body[resourcePath];

        // Admin can access all resources
        if (req.user.role === 'admin') {
            return next();
        }

        // User can only access their own resources
        if (req.user._id.toString() !== resourceOwnerId) {
            return next(new AppError('Access denied', 403));
        }

        next();
    };
};

/**
 * Middleware to validate refresh token
 */
const validateRefreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return next(new AppError('Refresh token is required', 400));
        }

        const decoded = jwtManager.verifyRefreshToken(refreshToken);

        // Find user and check if refresh token exists
        const user = await User.findById(decoded.id).select('+refreshTokens');
        if (!user) {
            return next(new AppError('User no longer exists', 401));
        }

        const storedToken = user.refreshTokens.find(rt => rt.token === refreshToken);
        if (!storedToken) {
            return next(new AppError('Invalid refresh token', 401));
        }

        req.user = user;
        req.refreshToken = refreshToken;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid refresh token', 401));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Refresh token has expired', 401));
        }
        logger.error('Refresh token validation error:', error);
        return next(new AppError('Token validation failed', 401));
    }
};

module.exports = {
    authenticate,
    optionalAuth,
    authorize,
    checkOwnership,
    validateRefreshToken
};
