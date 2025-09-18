const Testimonial = require('../models/Testimonial');
const { AppError, NotFoundError, ValidationError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class TestimonialService {
    /**
     * Create a new testimonial
     * @param {Object} testimonialData - Testimonial data
     * @param {Object} metadata - Request metadata
     * @returns {Object} Created testimonial
     */
    static async createTestimonial(testimonialData, metadata = {}) {
        try {
            const testimonial = new Testimonial({
                ...testimonialData,
                metadata: {
                    ipAddress: metadata.ip,
                    userAgent: metadata.userAgent,
                    source: metadata.source || 'website',
                    language: metadata.language || 'en'
                }
            });

            await testimonial.save();

            logger.info('New testimonial submitted', {
                testimonialId: testimonial._id,
                name: testimonial.name,
                rating: testimonial.rating,
                reviewLength: testimonial.review.length
            });

            return testimonial.toJSON();
        } catch (error) {
            logger.error('Error creating testimonial:', error);
            throw error;
        }
    }

    /**
     * Get testimonial by ID
     * @param {String} testimonialId - Testimonial ID
     * @param {Boolean} includePrivate - Include private fields (admin only)
     * @returns {Object} Testimonial data
     */
    static async getTestimonialById(testimonialId, includePrivate = false) {
        try {
            let query = Testimonial.findById(testimonialId);

            if (includePrivate) {
                query = query.select('+email +moderationNotes +approvedBy +approvedAt +rejectedAt');
            }

            const testimonial = await query;

            if (!testimonial) {
                throw new NotFoundError('Testimonial not found');
            }

            return testimonial.toJSON();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get testimonials with pagination and filtering
     * @param {Object} options - Query options
     * @returns {Object} Testimonials and pagination info
     */
    static async getTestimonials(options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                rating,
                isApproved,
                isFeatured,
                isVisible,
                sort = '-createdAt',
                includePrivate = false
            } = options;

            // Build query
            const query = {};

            if (rating) query.rating = parseInt(rating);
            if (isApproved !== undefined) query.isApproved = isApproved === 'true';
            if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
            if (isVisible !== undefined) query.isVisible = isVisible === 'true';

            // For public access, only show approved and visible testimonials
            if (!includePrivate) {
                query.isApproved = true;
                query.isVisible = true;
            }

            // Calculate pagination
            const skip = (page - 1) * limit;
            const total = await Testimonial.countDocuments(query);

            // Build query with optional private fields
            let testimonialQuery = Testimonial.find(query);

            if (includePrivate) {
                testimonialQuery = testimonialQuery.select('+email +moderationNotes +approvedBy');
            }

            const testimonials = await testimonialQuery
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit));

            return {
                testimonials: testimonials.map(testimonial => testimonial.toJSON()),
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
     * Get approved testimonials for public display
     * @param {Number} limit - Number of testimonials to return
     * @returns {Array} Approved testimonials
     */
    static async getApprovedTestimonials(limit = 10) {
        try {
            const testimonials = await Testimonial.getApproved(limit);
            return testimonials.map(testimonial => testimonial.toJSON());
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get featured testimonials
     * @returns {Array} Featured testimonials
     */
    static async getFeaturedTestimonials() {
        try {
            const testimonials = await Testimonial.getFeatured();
            return testimonials.map(testimonial => testimonial.toJSON());
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get testimonials by rating
     * @param {Number} rating - Star rating (1-5)
     * @returns {Array} Testimonials with specified rating
     */
    static async getTestimonialsByRating(rating) {
        try {
            if (rating < 1 || rating > 5) {
                throw new ValidationError('Rating must be between 1 and 5');
            }

            const testimonials = await Testimonial.getByRating(rating);
            return testimonials.map(testimonial => testimonial.toJSON());
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get rating statistics
     * @returns {Object} Rating statistics
     */
    static async getRatingStats() {
        try {
            const stats = await Testimonial.getRatingStats();

            logger.info('Rating statistics generated', {
                totalReviews: stats.totalReviews,
                averageRating: stats.averageRating
            });

            return stats;
        } catch (error) {
            logger.error('Error generating rating stats:', error);
            throw error;
        }
    }

    /**
     * Approve testimonial (admin/moderator only)
     * @param {String} testimonialId - Testimonial ID
     * @param {String} moderatorId - ID of the moderator approving
     * @param {String} notes - Optional moderation notes
     * @returns {Object} Updated testimonial
     */
    static async approveTestimonial(testimonialId, moderatorId, notes = '') {
        try {
            const testimonial = await Testimonial.findByIdAndUpdate(
                testimonialId,
                {
                    isApproved: true,
                    approvedBy: moderatorId,
                    approvedAt: new Date(),
                    ...(notes && { moderationNotes: notes })
                },
                { new: true, runValidators: true }
            ).select('+moderationNotes +approvedBy +approvedAt');

            if (!testimonial) {
                throw new NotFoundError('Testimonial not found');
            }

            logger.info('Testimonial approved', {
                testimonialId,
                moderatorId,
                rating: testimonial.rating
            });

            return testimonial.toJSON();
        } catch (error) {
            logger.error('Error approving testimonial:', error);
            throw error;
        }
    }

    /**
     * Reject testimonial (admin/moderator only)
     * @param {String} testimonialId - Testimonial ID
     * @param {String} moderatorId - ID of the moderator rejecting
     * @param {String} reason - Reason for rejection
     * @returns {Object} Updated testimonial
     */
    static async rejectTestimonial(testimonialId, moderatorId, reason) {
        try {
            const testimonial = await Testimonial.findByIdAndUpdate(
                testimonialId,
                {
                    isApproved: false,
                    isVisible: false,
                    rejectedAt: new Date(),
                    moderationNotes: reason
                },
                { new: true, runValidators: true }
            ).select('+moderationNotes +rejectedAt');

            if (!testimonial) {
                throw new NotFoundError('Testimonial not found');
            }

            logger.warn('Testimonial rejected', {
                testimonialId,
                moderatorId,
                reason
            });

            return testimonial.toJSON();
        } catch (error) {
            logger.error('Error rejecting testimonial:', error);
            throw error;
        }
    }

    /**
     * Feature testimonial (admin only)
     * @param {String} testimonialId - Testimonial ID
     * @param {Boolean} featured - Whether to feature or unfeature
     * @returns {Object} Updated testimonial
     */
    static async featureTestimonial(testimonialId, featured = true) {
        try {
            const testimonial = await Testimonial.findByIdAndUpdate(
                testimonialId,
                { isFeatured: featured },
                { new: true, runValidators: true }
            );

            if (!testimonial) {
                throw new NotFoundError('Testimonial not found');
            }

            // Only approved testimonials can be featured
            if (featured && !testimonial.isApproved) {
                throw new ValidationError('Only approved testimonials can be featured');
            }

            logger.info(`Testimonial ${featured ? 'featured' : 'unfeatured'}`, {
                testimonialId,
                rating: testimonial.rating
            });

            return testimonial.toJSON();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get pending testimonials for moderation
     * @returns {Array} Pending testimonials
     */
    static async getPendingTestimonials() {
        try {
            const testimonials = await Testimonial.getPendingModeration();

            logger.info('Pending testimonials retrieved', {
                count: testimonials.length
            });

            return testimonials.map(testimonial => testimonial.toJSON());
        } catch (error) {
            throw error;
        }
    }

    /**
     * Hide/show testimonial (admin only)
     * @param {String} testimonialId - Testimonial ID
     * @param {Boolean} visible - Whether testimonial should be visible
     * @returns {Object} Updated testimonial
     */
    static async toggleVisibility(testimonialId, visible = true) {
        try {
            const testimonial = await Testimonial.findByIdAndUpdate(
                testimonialId,
                { isVisible: visible },
                { new: true, runValidators: true }
            );

            if (!testimonial) {
                throw new NotFoundError('Testimonial not found');
            }

            logger.info(`Testimonial ${visible ? 'shown' : 'hidden'}`, {
                testimonialId
            });

            return testimonial.toJSON();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete testimonial (admin only)
     * @param {String} testimonialId - Testimonial ID
     */
    static async deleteTestimonial(testimonialId) {
        try {
            const testimonial = await Testimonial.findByIdAndDelete(testimonialId);

            if (!testimonial) {
                throw new NotFoundError('Testimonial not found');
            }

            logger.warn('Testimonial deleted', {
                testimonialId,
                name: testimonial.name,
                rating: testimonial.rating
            });

            return { message: 'Testimonial deleted successfully' };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get testimonial analytics
     * @param {Object} filters - Date range and other filters
     * @returns {Object} Testimonial analytics
     */
    static async getTestimonialAnalytics(filters = {}) {
        try {
            const { startDate, endDate } = filters;

            // Build date query
            const dateQuery = {};
            if (startDate || endDate) {
                dateQuery.createdAt = {};
                if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
                if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
            }

            // Get basic statistics
            const totalTestimonials = await Testimonial.countDocuments(dateQuery);
            const approvedTestimonials = await Testimonial.countDocuments({
                ...dateQuery,
                isApproved: true
            });
            const pendingTestimonials = await Testimonial.countDocuments({
                ...dateQuery,
                isApproved: false
            });

            // Get rating distribution
            const ratingStats = await Testimonial.getRatingStats();

            // Get testimonials over time (monthly)
            const timeSeriesData = await Testimonial.aggregate([
                { $match: dateQuery },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 },
                        averageRating: { $avg: '$rating' },
                        approved: {
                            $sum: { $cond: ['$isApproved', 1, 0] }
                        }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 12 }
            ]);

            // Get approval rate
            const approvalRate = totalTestimonials > 0 
                ? Math.round((approvedTestimonials / totalTestimonials) * 100 * 100) / 100
                : 0;

            return {
                summary: {
                    totalTestimonials,
                    approvedTestimonials,
                    pendingTestimonials,
                    approvalRate
                },
                ratings: ratingStats,
                timeSeries: timeSeriesData.map(item => ({
                    year: item._id.year,
                    month: item._id.month,
                    count: item.count,
                    averageRating: Math.round(item.averageRating * 100) / 100,
                    approved: item.approved,
                    approvalRate: Math.round((item.approved / item.count) * 100 * 100) / 100
                }))
            };
        } catch (error) {
            logger.error('Error generating testimonial analytics:', error);
            throw error;
        }
    }
}

module.exports = TestimonialService;
