const DonationService = require('../services/donationService');
const ResponseHandler = require('../utils/responseHandler');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class DonationController {
    /**
     * Create a new donation
     * POST /api/donations
     */
    static createDonation = asyncHandler(async (req, res) => {
        const donationData = req.body;

        // Add request metadata
        const metadata = {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            referrer: req.get('Referer'),
            source: 'website'
        };

        const donation = await DonationService.createDonation(donationData, metadata);

        logger.info('Donation submitted', {
            donationId: donation.id,
            amount: donation.amount,
            paymentMethod: donation.paymentMethod,
            ip: req.ip
        });

        ResponseHandler.created(res, donation, 'Donation submitted successfully');
    });

    /**
     * Get donation by ID
     * GET /api/donations/:id
     */
    static getDonationById = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const donation = await DonationService.getDonationById(id);

        ResponseHandler.success(res, donation, 'Donation retrieved successfully');
    });

    /**
     * Get donations with pagination and filtering
     * GET /api/donations
     */
    static getDonations = asyncHandler(async (req, res) => {
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            status: req.query.status,
            paymentMethod: req.query.paymentMethod,
            minAmount: req.query.minAmount,
            maxAmount: req.query.maxAmount,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            sort: req.query.sort || '-createdAt'
        };

        const result = await DonationService.getDonations(options);

        ResponseHandler.paginated(
            res,
            result.donations,
            result.pagination,
            'Donations retrieved successfully'
        );
    });

    /**
     * Get donation leaderboard
     * GET /api/donations/leaderboard
     */
    static getLeaderboard = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;

        const leaderboard = await DonationService.getLeaderboard(limit);

        ResponseHandler.success(
            res, 
            { leaderboard }, 
            'Leaderboard retrieved successfully'
        );
    });

    /**
     * Get donation statistics
     * GET /api/donations/stats
     */
    static getDonationStats = asyncHandler(async (req, res) => {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const stats = await DonationService.getDonationStats(filters);

        ResponseHandler.success(res, stats, 'Donation statistics retrieved');
    });

    /**
     * Update donation status (admin/payment processor webhook)
     * PATCH /api/donations/:id/status
     */
    static updateDonationStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status, transactionId } = req.body;

        const donation = await DonationService.updateDonationStatus(id, status, transactionId);

        logger.info('Donation status updated', {
            donationId: id,
            status,
            transactionId,
            updatedBy: req.user?.id || 'system'
        });

        ResponseHandler.success(res, donation, 'Donation status updated successfully');
    });

    /**
     * Get donations by donor email
     * GET /api/donations/by-email/:email
     */
    static getDonationsByEmail = asyncHandler(async (req, res) => {
        const { email } = req.params;
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10
        };

        const result = await DonationService.getDonationsByEmail(email, options);

        ResponseHandler.paginated(
            res,
            result.donations,
            result.pagination,
            'Donor donations retrieved successfully',
            200,
            { donorStats: result.donorStats }
        );
    });

    /**
     * Delete donation (admin only, for cleanup)
     * DELETE /api/donations/:id
     */
    static deleteDonation = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const result = await DonationService.deleteDonation(id);

        logger.warn('Donation deleted by admin', {
            donationId: id,
            deletedBy: req.user.id
        });

        ResponseHandler.success(res, result, 'Donation deleted successfully');
    });

    /**
     * Process donation webhook (for payment processors)
     * POST /api/donations/webhook
     */
    static processWebhook = asyncHandler(async (req, res) => {
        const webhookData = req.body;

        // This would typically validate webhook signature and process payment updates
        // For now, we'll just log the webhook data
        logger.info('Donation webhook received', {
            webhookData,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        // In a real implementation, you would:
        // 1. Verify webhook signature
        // 2. Extract donation ID and new status
        // 3. Update donation status
        // 4. Send confirmation emails

        ResponseHandler.success(res, { received: true }, 'Webhook processed successfully');
    });

    /**
     * Export donations to CSV (admin only)
     * GET /api/donations/export
     */
    static exportDonations = asyncHandler(async (req, res) => {
        const options = {
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            paymentMethod: req.query.paymentMethod
        };

        // Get all donations matching criteria (no pagination for export)
        const result = await DonationService.getDonations({ 
            ...options, 
            limit: 10000 // Large limit for export
        });

        // Convert to CSV format
        const csvData = result.donations.map(donation => ({
            id: donation.id,
            donorName: donation.isAnonymous ? 'Anonymous' : donation.donorName,
            donorEmail: donation.isAnonymous ? 'N/A' : donation.donorEmail,
            amount: donation.amount,
            currency: donation.currency,
            paymentMethod: donation.paymentMethod,
            status: donation.status,
            transactionId: donation.transactionId || 'N/A',
            message: donation.message || 'N/A',
            createdAt: donation.createdAt,
            processedAt: donation.processedAt || 'N/A'
        }));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=donations-export.csv');

        // Convert to CSV string (simple implementation)
        const csvString = [
            Object.keys(csvData[0]).join(','),
            ...csvData.map(row => Object.values(row).map(val => 
                typeof val === 'string' && val.includes(',') ? `"${val}"` : val
            ).join(','))
        ].join('\n');

        logger.info('Donations exported', {
            count: csvData.length,
            exportedBy: req.user.id,
            filters: options
        });

        res.send(csvString);
    });
}

module.exports = DonationController;
