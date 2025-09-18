const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwtManager = require('../config/jwt');
const config = require('../config/environment');
const { AppError, AuthError, ValidationError, ConflictError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class AuthService {
    /**
     * Register a new user
     * @param {Object} userData - User registration data
     * @returns {Object} User data and tokens
     */
    static async register(userData) {
        try {
            const { name, email, password } = userData;

            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                throw new ConflictError('Email is already registered');
            }

            // Create new user
            const user = new User({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password
            });

            await user.save();

            // Generate tokens
            const tokens = jwtManager.generateTokenPair(user);

            // Store refresh token
            await user.addRefreshToken(tokens.refreshToken);

            // Remove password from response
            const userResponse = user.toJSON();

            logger.logUserAction(user._id, 'REGISTER', { email });

            return {
                user: userResponse,
                tokens
            };
        } catch (error) {
            if (error.code === 11000) {
                throw new ConflictError('Email is already registered');
            }
            throw error;
        }
    }

    /**
     * Login user
     * @param {String} email - User email
     * @param {String} password - User password
     * @param {String} ipAddress - User IP address
     * @returns {Object} User data and tokens
     */
    static async login(email, password, ipAddress) {
        try {
            // Find user with password field
            const user = await User.findOne({ email: email.toLowerCase() })
                .select('+password +loginAttempts +lockUntil +refreshTokens');

            if (!user) {
                throw new AuthError('Invalid email or password');
            }

            // Check if account is locked
            if (user.isLocked) {
                logger.logSecurityEvent('LOGIN_ATTEMPT_LOCKED_ACCOUNT', { 
                    email, 
                    ipAddress,
                    lockUntil: user.lockUntil
                });
                throw new AuthError('Account is temporarily locked. Please try again later');
            }

            // Check if account is active
            if (!user.isActive) {
                throw new AuthError('Account is deactivated');
            }

            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                // Increment login attempts
                await user.incLoginAttempts();

                logger.logSecurityEvent('FAILED_LOGIN_ATTEMPT', { 
                    email, 
                    ipAddress,
                    attempts: user.loginAttempts + 1
                });

                throw new AuthError('Invalid email or password');
            }

            // Reset login attempts on successful login
            if (user.loginAttempts && user.loginAttempts > 0) {
                await user.resetLoginAttempts();
            }

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            // Generate tokens
            const tokens = jwtManager.generateTokenPair(user);

            // Store refresh token
            await user.addRefreshToken(tokens.refreshToken);

            // Remove sensitive fields from response
            const userResponse = user.toJSON();

            logger.logUserAction(user._id, 'LOGIN', { email, ipAddress });

            return {
                user: userResponse,
                tokens
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Refresh access token
     * @param {String} refreshToken - Refresh token
     * @returns {Object} New tokens
     */
    static async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwtManager.verifyRefreshToken(refreshToken);

            // Find user and validate refresh token
            const user = await User.findById(decoded.id).select('+refreshTokens');
            if (!user) {
                throw new AuthError('User not found');
            }

            const storedToken = user.refreshTokens.find(rt => rt.token === refreshToken);
            if (!storedToken) {
                throw new AuthError('Invalid refresh token');
            }

            // Generate new tokens
            const tokens = jwtManager.generateTokenPair(user);

            // Replace old refresh token with new one
            await user.removeRefreshToken(refreshToken);
            await user.addRefreshToken(tokens.refreshToken);

            logger.logUserAction(user._id, 'TOKEN_REFRESH');

            return { tokens };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Logout user
     * @param {String} userId - User ID
     * @param {String} refreshToken - Refresh token to remove
     */
    static async logout(userId, refreshToken = null) {
        try {
            const user = await User.findById(userId).select('+refreshTokens');
            if (!user) {
                throw new AuthError('User not found');
            }

            if (refreshToken) {
                // Remove specific refresh token
                await user.removeRefreshToken(refreshToken);
            } else {
                // Remove all refresh tokens (logout from all devices)
                user.refreshTokens = [];
                await user.save();
            }

            logger.logUserAction(userId, 'LOGOUT');
        } catch (error) {
            throw error;
        }
    }

    /**
     * Change user password
     * @param {String} userId - User ID
     * @param {String} currentPassword - Current password
     * @param {String} newPassword - New password
     */
    static async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await User.findById(userId).select('+password');
            if (!user) {
                throw new AuthError('User not found');
            }

            // Verify current password
            const isCurrentPasswordValid = await user.comparePassword(currentPassword);
            if (!isCurrentPasswordValid) {
                throw new AuthError('Current password is incorrect');
            }

            // Check if new password is different
            const isSamePassword = await user.comparePassword(newPassword);
            if (isSamePassword) {
                throw new ValidationError('New password must be different from current password');
            }

            // Update password
            user.password = newPassword;
            user.passwordChangedAt = new Date();

            // Clear all refresh tokens (force re-login on all devices)
            user.refreshTokens = [];

            await user.save();

            logger.logUserAction(userId, 'PASSWORD_CHANGE');

            return { message: 'Password changed successfully' };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get user profile
     * @param {String} userId - User ID
     * @returns {Object} User profile
     */
    static async getProfile(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new AuthError('User not found');
            }

            return user.toJSON();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update user profile
     * @param {String} userId - User ID
     * @param {Object} updateData - Profile update data
     * @returns {Object} Updated user profile
     */
    static async updateProfile(userId, updateData) {
        try {
            const allowedUpdates = ['name'];
            const updates = {};

            // Filter allowed updates
            for (const key of allowedUpdates) {
                if (updateData[key] !== undefined) {
                    updates[key] = updateData[key];
                }
            }

            if (Object.keys(updates).length === 0) {
                throw new ValidationError('No valid fields to update');
            }

            const user = await User.findByIdAndUpdate(
                userId,
                updates,
                { new: true, runValidators: true }
            );

            if (!user) {
                throw new AuthError('User not found');
            }

            logger.logUserAction(userId, 'PROFILE_UPDATE', { updates: Object.keys(updates) });

            return user.toJSON();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Deactivate user account
     * @param {String} userId - User ID
     */
    static async deactivateAccount(userId) {
        try {
            const user = await User.findByIdAndUpdate(
                userId,
                { 
                    isActive: false,
                    refreshTokens: [] // Clear all sessions
                },
                { new: true }
            );

            if (!user) {
                throw new AuthError('User not found');
            }

            logger.logUserAction(userId, 'ACCOUNT_DEACTIVATION');

            return { message: 'Account deactivated successfully' };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get user login history/stats
     * @param {String} userId - User ID
     * @returns {Object} User stats
     */
    static async getUserStats(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new AuthError('User not found');
            }

            return {
                lastLogin: user.lastLogin,
                accountCreated: user.createdAt,
                isVerified: user.isVerified,
                role: user.role,
                loginAttempts: user.loginAttempts || 0,
                isLocked: user.isLocked
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = AuthService;
