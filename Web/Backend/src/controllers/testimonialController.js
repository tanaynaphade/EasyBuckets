const TestimonialService = require('../services/testimonialService');
const ResponseHandler = require('../utils/responseHandler');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class TestimonialController {
    /**
     * Create a new testimonial
     * POST /api/testimonials
     */
    static createTestimonial = asyncHandler(async (req, res) => {
        const testimonialData = req.body;

        // Add request metadata
        const metadata = {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            source: 'website',
            language: req.get('Accept-Language')?.substring(0, 2) || 'en'
        };

        const testimonial = await TestimonialService.createTestimonial(testimonialData, metadata);

        logger.info('Testimonial submitted', {
            testimonialId: testimonial.id,
            name: testimonial.name,
            rating: testimonial.rating,
            ip: req.ip
        });

        ResponseHandler.created(res, testimonial, 'Testimonial submitted successfully');
    });

    /**
     * Get testimonial by ID
     * GET /api/testimonials/:id
     */
    static getTestimonialById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const includePrivate = req.user?.role === 'admin' || req.user?.role === 'moderator';

        const testimonial = await TestimonialService.getTestimonialById(id, includePrivate);

        ResponseHandler.success(res, testimonial, 'Testimonial retrieved successfully');
    });

    /**
     * Get testimonials with pagination and filtering
     * GET /api/testimonials
     */
    static getTestimonials = asyncHandler(async (req, res) => {
        const includePrivate = req.user?.role === 'admin' || req.user?.role === 'moderator';

        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            rating: req.query.rating,
            isApproved: req.query.isApproved,
            isFeatured: req.query.isFeatured,
            isVisible: req.query.isVisible,
            sort: req.query.sort || '-createdAt',
            includePrivate
        };

        const result = await TestimonialService.getTestimonials(options);

        ResponseHandler.paginated(
            res,
            result.testimonials,
            result.pagination,
            'Testimonials retrieved successfully'
        );
    });

    /**
     * Get approved testimonials for public display
     * GET /api/testimonials/approved
     */
    static getApprovedTestimonials = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;

        const testimonials = await TestimonialService.getApprovedTestimonials(limit);

        ResponseHandler.success(res, testimonials, 'Approved testimonials retrieved');
    });

    /**
     * Get featured testimonials
     * GET /api/testimonials/featured
     */
    static getFeaturedTestimonials = asyncHandler(async (req, res) => {
        const testimonials = await TestimonialService.getFeaturedTestimonials();

        ResponseHandler.success(res, testimonials, 'Featured testimonials retrieved');
    });

    /**
     * Get testimonials by rating
     * GET /api/testimonials/rating/:rating
     */
    static getTestimonialsByRating = asyncHandler(async (req, res) => {
        const { rating } = req.params;

        const testimonials = await TestimonialService.getTestimonialsByRating(parseInt(rating));

        ResponseHandler.success(
            res, 
            testimonials, 
            `${rating}-star testimonials retrieved`
        );
    });

    /**
     * Get rating statistics
     * GET /api/testimonials/stats/ratings
     */
    static getRatingStats = asyncHandler(async (req, res) => {
        const stats = await TestimonialService.getRatingStats();

        ResponseHandler.success(res, stats, 'Rating statistics retrieved');
    });

    /**
     * Approve testimonial (admin/moderator only)
     * PATCH /api/testimonials/:id/approve
     */
    static approveTestimonial = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { notes } = req.body;
        const moderatorId = req.user.id;

        const testimonial = await TestimonialService.approveTestimonial(id, moderatorId, notes);

        logger.info('Testimonial approved', {
            testimonialId: id,
            moderatorId,
            moderatorRole: req.user.role
        });

        ResponseHandler.success(res, testimonial, 'Testimonial approved successfully');
    });

    /**
     * Reject testimonial (admin/moderator only)
     * PATCH /api/testimonials/:id/reject
     */
    static rejectTestimonial = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;
        const moderatorId = req.user.id;

        const testimonial = await TestimonialService.rejectTestimonial(id, moderatorId, reason);

        logger.warn('Testimonial rejected', {
            testimonialId: id,
            moderatorId,
            reason
        });

        ResponseHandler.success(res, testimonial, 'Testimonial rejected');
    });

    /**
     * Feature/unfeature testimonial (admin only)
     * PATCH /api/testimonials/:id/feature
     */
    static featureTestimonial = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { featured = true } = req.body;

        const testimonial = await TestimonialService.featureTestimonial(id, featured);

        logger.info(`Testimonial ${featured ? 'featured' : 'unfeatured'}`, {
            testimonialId: id,
            adminId: req.user.id
        });

        ResponseHandler.success(
            res, 
            testimonial, 
            `Testimonial ${featured ? 'featured' : 'unfeatured'} successfully`
        );
    });

    /**
     * Get pending testimonials for moderation
     * GET /api/testimonials/pending
     */
    static getPendingTestimonials = asyncHandler(async (req, res) => {
        const testimonials = await TestimonialService.getPendingTestimonials();

        ResponseHandler.success(res, testimonials, 'Pending testimonials retrieved');
    });

    /**
     * Toggle testimonial visibility (admin only)
     * PATCH /api/testimonials/:id/visibility
     */
    static toggleVisibility = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { visible = true } = req.body;

        const testimonial = await TestimonialService.toggleVisibility(id, visible);

        logger.info(`Testimonial ${visible ? 'shown' : 'hidden'}`, {
            testimonialId: id,
            adminId: req.user.id
        });

        ResponseHandler.success(
            res, 
            testimonial, 
            `Testimonial ${visible ? 'shown' : 'hidden'} successfully`
        );
    });

    /**
     * Delete testimonial (admin only)
     * DELETE /api/testimonials/:id
     */
    static deleteTestimonial = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const result = await TestimonialService.deleteTestimonial(id);

        logger.warn('Testimonial deleted by admin', {
            testimonialId: id,
            deletedBy: req.user.id
        });

        ResponseHandler.success(res, result, 'Testimonial deleted successfully');
    });

    /**
     * Get testimonial analytics (admin only)
     * GET /api/testimonials/analytics
     */
    static getTestimonialAnalytics = asyncHandler(async (req, res) => {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const analytics = await TestimonialService.getTestimonialAnalytics(filters);

        ResponseHandler.success(res, analytics, 'Testimonial analytics retrieved');
    });

    /**
     * Bulk approve testimonials (admin only)
     * POST /api/testimonials/bulk-approve
     */
    static bulkApproveTestimonials = asyncHandler(async (req, res) => {
        const { testimonialIds, notes } = req.body;
        const moderatorId = req.user.id;

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const id of testimonialIds) {
            try {
                const testimonial = await TestimonialService.approveTestimonial(id, moderatorId, notes);
                results.push({ id, success: true, testimonial });
                successCount++;
            } catch (error) {
                results.push({ id, success: false, error: error.message });
                errorCount++;
            }
        }

        logger.info('Bulk testimonial approval completed', {
            moderatorId,
            totalProcessed: testimonialIds.length,
            successCount,
            errorCount
        });

        ResponseHandler.success(res, {
            results,
            summary: {
                totalProcessed: testimonialIds.length,
                successCount,
                errorCount
            }
        }, 'Bulk approval completed');
    });

    /**
     * Export testimonials to CSV (admin only)
     * GET /api/testimonials/export
     */
    static exportTestimonials = asyncHandler(async (req, res) => {
        const options = {
            isApproved: req.query.isApproved,
            rating: req.query.rating,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            includePrivate: true,
            limit: 10000 // Large limit for export
        };

        const result = await TestimonialService.getTestimonials(options);

        // Convert to CSV format
        const csvData = result.testimonials.map(testimonial => ({
            id: testimonial.id,
            name: testimonial.name,
            rating: testimonial.rating,
            review: testimonial.review.replace(/,/g, ';'), // Replace commas to avoid CSV issues
            isApproved: testimonial.isApproved,
            isFeatured: testimonial.isFeatured,
            isVisible: testimonial.isVisible,
            createdAt: testimonial.createdAt,
            approvedAt: testimonial.approvedAt || 'N/A'
        }));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=testimonials-export.csv');

        // Convert to CSV string
        const csvString = [
            Object.keys(csvData[0]).join(','),
            ...csvData.map(row => Object.values(row).map(val => 
                typeof val === 'string' && val.includes(',') ? `"${val}"` : val
            ).join(','))
        ].join('\n');

        logger.info('Testimonials exported', {
            count: csvData.length,
            exportedBy: req.user.id,
            filters: options
        });

        res.send(csvString);
    });
}

module.exports = TestimonialController;
