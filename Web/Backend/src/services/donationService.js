const Donation = require('../models/Donation');
const { AppError, NotFoundError, ValidationError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class DonationService {
    /**
     * Create a new donation
     * @param {Object} donationData - Donation data
     * @param {Object} metadata - Request metadata (IP, User-Agent, etc.)
     * @returns {Object} Created donation
     */
    static async createDonation(donationData, metadata = {}) {
        try {
            const donation = new Donation({
                ...donationData,
                metadata: {
                    ipAddress: metadata.ip,
                    userAgent: metadata.userAgent,
                    referrer: metadata.referrer,
                    source: metadata.source || 'website'
                }
            });

            await donation.save();

            logger.info('New donation created', {
                donationId: donation._id,
                amount: donation.amount,
                donorEmail: donation.isAnonymous ? '[ANONYMOUS]' : donation.donorEmail,
                paymentMethod: donation.paymentMethod
            });

            return donation.toJSON();
        } catch (error) {
            logger.error('Error creating donation:', error);
            throw error;
        }
    }

    /**
     * Get donation by ID
     * @param {String} donationId - Donation ID
     * @returns {Object} Donation data
     */
    static async getDonationById(donationId) {
        try {
            const donation = await Donation.findById(donationId);

            if (!donation) {
                throw new NotFoundError('Donation not found');
            }

            return donation.toJSON();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get donations with pagination and filtering
     * @param {Object} options - Query options
     * @returns {Object} Donations and pagination info
     */
    static async getDonations(options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                paymentMethod,
                minAmount,
                maxAmount,
                startDate,
                endDate,
                sort = '-createdAt'
            } = options;

            // Build query
            const query = {};

            if (status) query.status = status;
            if (paymentMethod) query.paymentMethod = paymentMethod;

            if (minAmount || maxAmount) {
                query.amount = {};
                if (minAmount) query.amount.$gte = parseFloat(minAmount);
                if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
            }

            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Calculate pagination
            const skip = (page - 1) * limit;
            const total = await Donation.countDocuments(query);

            // Fetch donations
            const donations = await Donation.find(query)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit));

            return {
                donations: donations.map(donation => donation.toJSON()),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get donation leaderboard
     * @param {Number} limit - Number of top donors to return
     * @returns {Array} Leaderboard data
     */
    static async getLeaderboard(limit = 10) {
        try {
            const leaderboard = await Donation.getLeaderboard(limit);

            logger.info('Leaderboard generated', { 
                topDonors: leaderboard.length,
                limit 
            });

            return leaderboard;
        } catch (error) {
            logger.error('Error generating leaderboard:', error);
            throw error;
        }
    }

    /**
     * Get donation statistics
     * @param {Object} filters - Date range and other filters
     * @returns {Object} Donation statistics
     */
    static async getDonationStats(filters = {}) {
        try {
            const { startDate, endDate } = filters;

            // Get basic stats
            const basicStats = await Donation.getStats();

            // Get stats for date range if provided
            let periodStats = null;
            if (startDate || endDate) {
                const query = { status: 'completed' };

                if (startDate || endDate) {
                    query.createdAt = {};
                    if (startDate) query.createdAt.$gte = new Date(startDate);
                    if (endDate) query.createdAt.$lte = new Date(endDate);
                }

                const periodData = await Donation.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: '$amount' },
                            totalDonations: { $sum: 1 },
                            averageAmount: { $avg: '$amount' },
                            maxAmount: { $max: '$amount' },
                            minAmount: { $min: '$amount' }
                        }
                    }
                ]);

                periodStats = periodData[0] || {
                    totalAmount: 0,
                    totalDonations: 0,
                    averageAmount: 0,
                    maxAmount: 0,
                    minAmount: 0
                };
            }

            // Get donation trends (monthly breakdown)
            const trends = await Donation.aggregate([
                { $match: { status: 'completed' } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        totalAmount: { $sum: '$amount' },
                        totalDonations: { $sum: 1 },
                        averageAmount: { $avg: '$amount' }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 12 } // Last 12 months
            ]);

            // Payment method distribution
            const paymentMethodStats = await Donation.aggregate([
                { $match: { status: 'completed' } },
                {
                    $group: {
                        _id: '$paymentMethod',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' }
                    }
                },
                { $sort: { totalAmount: -1 } }
            ]);

            return {
                overall: basicStats,
                ...(periodStats && { period: periodStats }),
                trends: trends.map(trend => ({
                    year: trend._id.year,
                    month: trend._id.month,
                    totalAmount: trend.totalAmount,
                    totalDonations: trend.totalDonations,
                    averageAmount: Math.round(trend.averageAmount * 100) / 100
                })),
                paymentMethods: paymentMethodStats.map(pm => ({
                    method: pm._id,
                    count: pm.count,
                    totalAmount: pm.totalAmount,
                    percentage: Math.round((pm.totalAmount / basicStats.totalAmount) * 100 * 100) / 100
                }))
            };
        } catch (error) {
            logger.error('Error generating donation stats:', error);
            throw error;
        }
    }

    /**
     * Update donation status (for payment processing)
     * @param {String} donationId - Donation ID
     * @param {String} status - New status
     * @param {String} transactionId - Transaction ID from payment processor
     * @returns {Object} Updated donation
     */
    static async updateDonationStatus(donationId, status, transactionId = null) {
        try {
            const updateData = { status };

            if (transactionId) {
                updateData.transactionId = transactionId;
            }

            if (status === 'completed') {
                updateData.processedAt = new Date();
            } else if (status === 'refunded') {
                updateData.refundedAt = new Date();
            }

            const donation = await Donation.findByIdAndUpdate(
                donationId,
                updateData,
                { new: true, runValidators: true }
            );

            if (!donation) {
                throw new NotFoundError('Donation not found');
            }

            logger.info('Donation status updated', {
                donationId,
                oldStatus: 'pending',
                newStatus: status,
                transactionId
            });

            return donation.toJSON();
        } catch (error) {
            logger.error('Error updating donation status:', error);
            throw error;
        }
    }

    /**
     * Get donations by donor email
     * @param {String} email - Donor email
     * @param {Object} options - Query options
     * @returns {Object} Donations and pagination info
     */
    static async getDonationsByEmail(email, options = {}) {
        try {
            const { page = 1, limit = 10 } = options;

            const query = { 
                donorEmail: email.toLowerCase(),
                status: 'completed'
            };

            const skip = (page - 1) * limit;
            const total = await Donation.countDocuments(query);

            const donations = await Donation.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            // Calculate donor stats
            const donorStats = await Donation.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$amount' },
                        totalDonations: { $sum: 1 },
                        firstDonation: { $min: '$createdAt' },
                        lastDonation: { $max: '$createdAt' }
                    }
                }
            ]);

            return {
                donations: donations.map(donation => donation.toJSON()),
                donorStats: donorStats[0] || {
                    totalAmount: 0,
                    totalDonations: 0,
                    firstDonation: null,
                    lastDonation: null
                },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete donation (admin only, for testing/cleanup)
     * @param {String} donationId - Donation ID
     */
    static async deleteDonation(donationId) {
        try {
            const donation = await Donation.findByIdAndDelete(donationId);

            if (!donation) {
                throw new NotFoundError('Donation not found');
            }

            logger.warn('Donation deleted', {
                donationId,
                amount: donation.amount,
                donorEmail: donation.donorEmail
            });

            return { message: 'Donation deleted successfully' };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = DonationService;
