const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [100, 'Name must not exceed 100 characters']
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
        select: false // Don't include email in queries by default for privacy
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: [1, 'Rating must be between 1 and 5'],
        max: [5, 'Rating must be between 1 and 5'],
        validate: {
            validator: function(v) {
                return Number.isInteger(v) && v >= 1 && v <= 5;
            },
            message: 'Rating must be an integer between 1 and 5'
        }
    },
    review: {
        type: String,
        required: [true, 'Review text is required'],
        trim: true,
        minlength: [10, 'Review must be at least 10 characters'],
        maxlength: [1000, 'Review must not exceed 1000 characters']
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        source: {
            type: String,
            enum: ['website', 'mobile_app', 'api'],
            default: 'website'
        },
        language: {
            type: String,
            default: 'en'
        }
    },
    moderationNotes: {
        type: String,
        maxlength: [500, 'Moderation notes must not exceed 500 characters'],
        select: false
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        select: false
    },
    approvedAt: {
        type: Date,
        select: false
    },
    rejectedAt: {
        type: Date,
        select: false
    }
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.__v;
            delete ret.email; // Always hide email in JSON output
            delete ret.metadata;
            delete ret.moderationNotes;
            delete ret.approvedBy;
            delete ret.approvedAt;
            delete ret.rejectedAt;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes
testimonialSchema.index({ rating: -1 });
testimonialSchema.index({ isApproved: 1, isVisible: 1 });
testimonialSchema.index({ isFeatured: 1 });
testimonialSchema.index({ createdAt: -1 });

// Virtual for star display
testimonialSchema.virtual('stars').get(function() {
    return '★'.repeat(this.rating) + '☆'.repeat(5 - this.rating);
});

// Virtual for review preview (first 100 characters)
testimonialSchema.virtual('reviewPreview').get(function() {
    if (this.review.length <= 100) {
        return this.review;
    }
    return this.review.substring(0, 100) + '...';
});

// Pre-save middleware
testimonialSchema.pre('save', function(next) {
    // Auto-approve high ratings from verified sources (optional business logic)
    if (this.isNew && this.rating >= 4 && !this.isApproved) {
        // You could add additional checks here
    }

    // Set approval timestamp
    if (this.isModified('isApproved') && this.isApproved && !this.approvedAt) {
        this.approvedAt = new Date();
    }

    next();
});

// Static method to get approved testimonials
testimonialSchema.statics.getApproved = function(limit = 10) {
    return this.find({ 
        isApproved: true, 
        isVisible: true 
    })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get featured testimonials
testimonialSchema.statics.getFeatured = function() {
    return this.find({ 
        isApproved: true, 
        isVisible: true,
        isFeatured: true 
    }).sort({ createdAt: -1 });
};

// Static method to get testimonials by rating
testimonialSchema.statics.getByRating = function(rating) {
    return this.find({ 
        rating,
        isApproved: true,
        isVisible: true 
    }).sort({ createdAt: -1 });
};

// Static method to get rating statistics
testimonialSchema.statics.getRatingStats = async function() {
    const stats = await this.aggregate([
        { 
            $match: { 
                isApproved: true, 
                isVisible: true 
            } 
        },
        {
            $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                averageRating: { $avg: '$rating' },
                ratingDistribution: {
                    $push: '$rating'
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalReviews: 1,
                averageRating: { $round: ['$averageRating', 2] },
                ratingCounts: {
                    '5': {
                        $size: {
                            $filter: {
                                input: '$ratingDistribution',
                                cond: { $eq: ['$$this', 5] }
                            }
                        }
                    },
                    '4': {
                        $size: {
                            $filter: {
                                input: '$ratingDistribution',
                                cond: { $eq: ['$$this', 4] }
                            }
                        }
                    },
                    '3': {
                        $size: {
                            $filter: {
                                input: '$ratingDistribution',
                                cond: { $eq: ['$$this', 3] }
                            }
                        }
                    },
                    '2': {
                        $size: {
                            $filter: {
                                input: '$ratingDistribution',
                                cond: { $eq: ['$$this', 2] }
                            }
                        }
                    },
                    '1': {
                        $size: {
                            $filter: {
                                input: '$ratingDistribution',
                                cond: { $eq: ['$$this', 1] }
                            }
                        }
                    }
                }
            }
        }
    ]);

    return stats[0] || {
        totalReviews: 0,
        averageRating: 0,
        ratingCounts: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
    };
};

// Static method to get pending testimonials for moderation
testimonialSchema.statics.getPendingModeration = function() {
    return this.find({ isApproved: false })
           .select('+email +moderationNotes +approvedBy')
           .sort({ createdAt: 1 });
};

module.exports = mongoose.model('Testimonial', testimonialSchema);
