const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('../utils/errorHandler');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Handle validation results
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
        }));

        return next(new AppError('Validation failed', 400, errorMessages));
    }
    next();
};

/**
 * User registration validation
 */
const validateRegistration = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
        .custom(async (email) => {
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                throw new Error('Email is already registered');
            }
            return true;
        }),

    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),

    handleValidationErrors
];

/**
 * User login validation
 */
const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    body('password')
        .notEmpty()
        .withMessage('Password is required'),

    handleValidationErrors
];

/**
 * Donation validation
 */
const validateDonation = [
    body('donorName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Donor name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

    body('donorEmail')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    body('amount')
        .isFloat({ min: 1, max: 10000 })
        .withMessage('Amount must be between $1 and $10,000'),

    body('currency')
        .optional()
        .isIn(['USD', 'EUR', 'GBP', 'CAD'])
        .withMessage('Invalid currency'),

    body('message')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Message must not exceed 500 characters'),

    body('isAnonymous')
        .optional()
        .isBoolean()
        .withMessage('isAnonymous must be a boolean value'),

    body('paymentMethod')
        .isIn(['credit_card', 'paypal', 'bank_transfer', 'crypto'])
        .withMessage('Invalid payment method'),

    handleValidationErrors
];

/**
 * Testimonial validation
 */
const validateTestimonial = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be an integer between 1 and 5'),

    body('review')
        .trim()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Review must be between 10 and 1000 characters'),

    handleValidationErrors
];

/**
 * MongoDB ObjectId validation
 */
const validateObjectId = (paramName = 'id') => [
    param(paramName)
        .custom((value) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error('Invalid ID format');
            }
            return true;
        }),
    handleValidationErrors
];

/**
 * Pagination validation
 */
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

    query('sort')
        .optional()
        .isIn(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'name', '-name'])
        .withMessage('Invalid sort parameter'),

    handleValidationErrors
];

/**
 * Password change validation
 */
const validatePasswordChange = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),

    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),

    handleValidationErrors
];

/**
 * Email validation (for password reset, etc.)
 */
const validateEmail = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    handleValidationErrors
];

/**
 * Search validation
 */
const validateSearch = [
    query('q')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters'),

    query('type')
        .optional()
        .isIn(['donations', 'testimonials', 'users'])
        .withMessage('Invalid search type'),

    handleValidationErrors
];

/**
 * Custom sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
    // Remove any HTML tags and scripts from string inputs
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        return str
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .trim();
    };

    // Recursively sanitize object
    const sanitizeObject = (obj) => {
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (typeof obj[key] === 'string') {
                    obj[key] = sanitizeString(obj[key]);
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key]);
                }
            }
        }
    };

    // Sanitize request body, query, and params
    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);

    next();
};

module.exports = {
    validateRegistration,
    validateLogin,
    validateDonation,
    validateTestimonial,
    validateObjectId,
    validatePagination,
    validatePasswordChange,
    validateEmail,
    validateSearch,
    sanitizeInput,
    handleValidationErrors
};
