const express = require('express');
const TestimonialController = require('../controllers/testimonialController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { 
    validateTestimonial, 
    validateObjectId, 
    validatePagination,
    sanitizeInput 
} = require('../middleware/validation');
const { 
    testimonialLimiter, 
    generalLimiter 
} = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes (no authentication required)
router.post('/',
    testimonialLimiter,
    sanitizeInput,
    validateTestimonial,
    TestimonialController.createTestimonial
);

router.get('/approved',
    generalLimiter,
    TestimonialController.getApprovedTestimonials
);

router.get('/featured',
    generalLimiter,
    TestimonialController.getFeaturedTestimonials
);

router.get('/rating/:rating',
    generalLimiter,
    TestimonialController.getTestimonialsByRating
);

router.get('/stats/ratings',
    generalLimiter,
    TestimonialController.getRatingStats
);

// Routes with optional authentication (different data for authenticated users)
router.get('/',
    optionalAuth,
    validatePagination,
    TestimonialController.getTestimonials
);

router.get('/:id',
    optionalAuth,
    validateObjectId('id'),
    TestimonialController.getTestimonialById
);

// Protected routes (authentication required)
// Moderator routes
router.use(authenticate); // All routes below require authentication

router.get('/pending',
    authorize('admin', 'moderator'),
    TestimonialController.getPendingTestimonials
);

router.patch('/:id/approve',
    authorize('admin', 'moderator'),
    validateObjectId('id'),
    sanitizeInput,
    TestimonialController.approveTestimonial
);

router.patch('/:id/reject',
    authorize('admin', 'moderator'),
    validateObjectId('id'),
    sanitizeInput,
    TestimonialController.rejectTestimonial
);

router.post('/bulk-approve',
    authorize('admin', 'moderator'),
    sanitizeInput,
    TestimonialController.bulkApproveTestimonials
);

// Admin-only routes
router.get('/analytics',
    authorize('admin'),
    TestimonialController.getTestimonialAnalytics
);

router.get('/export',
    authorize('admin'),
    TestimonialController.exportTestimonials
);

router.patch('/:id/feature',
    authorize('admin'),
    validateObjectId('id'),
    sanitizeInput,
    TestimonialController.featureTestimonial
);

router.patch('/:id/visibility',
    authorize('admin'),
    validateObjectId('id'),
    sanitizeInput,
    TestimonialController.toggleVisibility
);

router.delete('/:id',
    authorize('admin'),
    validateObjectId('id'),
    TestimonialController.deleteTestimonial
);

module.exports = router;
