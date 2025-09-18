const AuthService = require('../services/authService');
const ResponseHandler = require('../utils/responseHandler');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class AuthController {
    /**
     * Register a new user
     * POST /api/auth/register
     */
    static register = asyncHandler(async (req, res) => {
        const { name, email, password } = req.body;

        const result = await AuthService.register({ name, email, password });

        logger.logUserAction(result.user.id, 'REGISTER_SUCCESS', { 
            email: result.user.email 
        });

        ResponseHandler.created(res, result, 'User registered successfully');
    });

    /**
     * Login user
     * POST /api/auth/login
     */
    static login = asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        const ipAddress = req.ip;

        const result = await AuthService.login(email, password, ipAddress);

        ResponseHandler.success(res, result, 'Login successful');
    });

    /**
     * Refresh access token
     * POST /api/auth/refresh
     */
    static refreshToken = asyncHandler(async (req, res) => {
        const { refreshToken } = req.body;

        const result = await AuthService.refreshToken(refreshToken);

        ResponseHandler.success(res, result, 'Token refreshed successfully');
    });

    /**
     * Logout user
     * POST /api/auth/logout
     */
    static logout = asyncHandler(async (req, res) => {
        const { refreshToken } = req.body;
        const userId = req.user.id;

        await AuthService.logout(userId, refreshToken);

        ResponseHandler.success(res, null, 'Logged out successfully');
    });

    /**
     * Logout from all devices
     * POST /api/auth/logout-all
     */
    static logoutAll = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        await AuthService.logout(userId); // No refresh token = logout all

        ResponseHandler.success(res, null, 'Logged out from all devices');
    });

    /**
     * Get current user profile
     * GET /api/auth/profile
     */
    static getProfile = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const profile = await AuthService.getProfile(userId);

        ResponseHandler.success(res, profile, 'Profile retrieved successfully');
    });

    /**
     * Update user profile
     * PUT /api/auth/profile
     */
    static updateProfile = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const updateData = req.body;

        const updatedProfile = await AuthService.updateProfile(userId, updateData);

        logger.logUserAction(userId, 'PROFILE_UPDATE_SUCCESS');

        ResponseHandler.success(res, updatedProfile, 'Profile updated successfully');
    });

    /**
     * Change user password
     * POST /api/auth/change-password
     */
    static changePassword = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        const result = await AuthService.changePassword(userId, currentPassword, newPassword);

        logger.logUserAction(userId, 'PASSWORD_CHANGE_SUCCESS');

        ResponseHandler.success(res, result, 'Password changed successfully');
    });

    /**
     * Deactivate user account
     * DELETE /api/auth/account
     */
    static deactivateAccount = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const result = await AuthService.deactivateAccount(userId);

        logger.logUserAction(userId, 'ACCOUNT_DEACTIVATION');

        ResponseHandler.success(res, result, 'Account deactivated successfully');
    });

    /**
     * Get user statistics
     * GET /api/auth/stats
     */
    static getUserStats = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const stats = await AuthService.getUserStats(userId);

        ResponseHandler.success(res, stats, 'User statistics retrieved');
    });

    /**
     * Verify token (for middleware testing)
     * GET /api/auth/verify
     */
    static verifyToken = asyncHandler(async (req, res) => {
        // If we reach here, token is valid (middleware passed)
        const user = req.user;

        ResponseHandler.success(res, {
            isValid: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        }, 'Token is valid');
    });

    /**
     * Get current user session info
     * GET /api/auth/session
     */
    static getSessionInfo = asyncHandler(async (req, res) => {
        const user = req.user;

        const sessionInfo = {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            loginTime: user.lastLogin,
            sessionValid: true
        };

        ResponseHandler.success(res, sessionInfo, 'Session information retrieved');
    });
}

module.exports = AuthController;
