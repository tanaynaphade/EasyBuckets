const jwt = require('jsonwebtoken');
const config = require('./environment');
const logger = require('../utils/logger');

class JWTManager {
    constructor() {
        this.secret = config.JWT.SECRET;
        this.refreshSecret = config.JWT.REFRESH_SECRET;
        this.expiresIn = config.JWT.EXPIRES_IN;
        this.refreshExpiresIn = config.JWT.REFRESH_EXPIRES_IN;
    }

    /**
     * Generate access token
     * @param {Object} payload - Token payload
     * @returns {String} JWT token
     */
    generateAccessToken(payload) {
        try {
            const tokenPayload = {
                id: payload.id,
                email: payload.email,
                role: payload.role || 'user',
                iat: Math.floor(Date.now() / 1000)
            };

            return jwt.sign(tokenPayload, this.secret, {
                expiresIn: this.expiresIn,
                issuer: 'nba-analytics',
                audience: 'nba-analytics-users'
            });
        } catch (error) {
            logger.error('Error generating access token:', error);
            throw error;
        }
    }

    /**
     * Generate refresh token
     * @param {Object} payload - Token payload 
     * @returns {String} Refresh token
     */
    generateRefreshToken(payload) {
        try {
            return jwt.sign(
                { id: payload.id, tokenType: 'refresh' },
                this.refreshSecret,
                { 
                    expiresIn: this.refreshExpiresIn,
                    issuer: 'nba-analytics'
                }
            );
        } catch (error) {
            logger.error('Error generating refresh token:', error);
            throw error;
        }
    }

    /**
     * Generate both access and refresh tokens
     * @param {Object} user - User object
     * @returns {Object} Token pair
     */
    generateTokenPair(user) {
        const payload = {
            id: user._id.toString(),
            email: user.email,
            role: user.role
        };

        return {
            accessToken: this.generateAccessToken(payload),
            refreshToken: this.generateRefreshToken(payload),
            expiresIn: this.expiresIn
        };
    }

    /**
     * Verify access token
     * @param {String} token - JWT token
     * @returns {Object} Decoded payload
     */
    verifyAccessToken(token) {
        try {
            return jwt.verify(token, this.secret, {
                issuer: 'nba-analytics',
                audience: 'nba-analytics-users'
            });
        } catch (error) {
            logger.warn('Invalid access token:', error.message);
            throw error;
        }
    }

    /**
     * Verify refresh token
     * @param {String} token - Refresh token
     * @returns {Object} Decoded payload
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, this.refreshSecret, {
                issuer: 'nba-analytics'
            });

            if (decoded.tokenType !== 'refresh') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            logger.warn('Invalid refresh token:', error.message);
            throw error;
        }
    }

    /**
     * Extract token from Authorization header
     * @param {String} authHeader - Authorization header value
     * @returns {String} Token
     */
    extractToken(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Invalid authorization header format');
        }
        return authHeader.substring(7);
    }

    /**
     * Decode token without verification (for debugging)
     * @param {String} token - JWT token
     * @returns {Object} Decoded payload
     */
    decodeToken(token) {
        return jwt.decode(token, { complete: true });
    }
}

module.exports = new JWTManager();
