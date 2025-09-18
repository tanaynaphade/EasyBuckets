const express = require('express');
const DonationController = require('../controllers/donationController');
const { authenticate, authorize } = require('../middleware/auth');
const { 
    validateDonation, 
    validateObjectId, 
    validatePagination,
    sanitizeInput 
} = require('../middleware/validation');
const { 
    donationLimiter, 
    generalLimiter 
} = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes (no authentication required)
router.post('/',
    donationLimiter,
    sanitizeInput,
    validateDonation,
    DonationController.createDonation
);

router.get('/leaderboard',
    generalLimiter,
    DonationController.getLeaderboard
);

router.get('/stats',
    generalLimiter,
    DonationController.getDonationStats
);

// Webhook route for payment processors (no auth, but should validate signature in real app)
router.post('/webhook',
    DonationController.processWebhook
);

// Protected routes (authentication required)
router.get('/',
    authenticate,
    validatePagination,
    DonationController.getDonations
);

router.get('/export',
    authenticate,
    authorize('admin'),
    DonationController.exportDonations
);

router.get('/by-email/:email',
    authenticate,
    authorize('admin', 'moderator'),
    validatePagination,
    DonationController.getDonationsByEmail
);

router.get('/:id',
    authenticate,
    authorize('admin', 'moderator'),
    validateObjectId('id'),
    DonationController.getDonationById
);

// Admin routes
router.patch('/:id/status',
    authenticate,
    authorize('admin'),
    validateObjectId('id'),
    sanitizeInput,
    DonationController.updateDonationStatus
);

router.delete('/:id',
    authenticate,
    authorize('admin'),
    validateObjectId('id'),
    DonationController.deleteDonation
);

module.exports = router;
