const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticate, validateRefreshToken } = require('../middleware/auth');
const { 
    validateRegistration, 
    validateLogin, 
    validatePasswordChange,
    sanitizeInput 
} = require('../middleware/validation');
const { 
    authLimiter, 
    registrationLimiter, 
    passwordResetLimiter 
} = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', 
    registrationLimiter,
    sanitizeInput,
    validateRegistration,
    AuthController.register
);

router.post('/login', 
    authLimiter,
    sanitizeInput,
    validateLogin,
    AuthController.login
);

router.post('/refresh',
    authLimiter,
    validateRefreshToken,
    AuthController.refreshToken
);

// Protected routes (authentication required)
router.use(authenticate); // All routes below require authentication

router.post('/logout',
    AuthController.logout
);

router.post('/logout-all',
    AuthController.logoutAll
);

router.get('/profile',
    AuthController.getProfile
);

router.put('/profile',
    sanitizeInput,
    AuthController.updateProfile
);

router.post('/change-password',
    passwordResetLimiter,
    sanitizeInput,
    validatePasswordChange,
    AuthController.changePassword
);

router.delete('/account',
    AuthController.deactivateAccount
);

router.get('/stats',
    AuthController.getUserStats
);

router.get('/verify',
    AuthController.verifyToken
);

router.get('/session',
    AuthController.getSessionInfo
);

module.exports = router;
