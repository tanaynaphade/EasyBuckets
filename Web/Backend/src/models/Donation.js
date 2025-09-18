const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    donorName: {
        type: String,
        required: [true, 'Donor name is required'],
        trim: true,
        minlength: [2, 'Donor name must be at least 2 characters'],
        maxlength: [100, 'Donor name must not exceed 100 characters']
    },
    donorEmail: {
        type: String,
        required: [true, 'Donor email is required'],
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    amount: {
        type: Number,
        required: [true, 'Donation amount is required'],
        min: [1, 'Minimum donation amount is $1'],
        max: [10000, 'Maximum donation amount is $10,000'],
        validate: {
            validator: function(v) {
                return Number.isFinite(v) && v > 0;
            },
            message: 'Amount must be a positive number'
        }
    },
    currency: {
        type: String,
        required: true,
        enum: ['USD', 'EUR', 'GBP', 'CAD'],
        default: 'USD'
    },
    message: {
        type: String,
        trim: true,
        maxlength: [500, 'Message must not exceed 500 characters']
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true // Allow null values but ensure uniqueness when present
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['credit_card', 'paypal', 'bank_transfer', 'crypto'],
        required: true
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        referrer: String,
        utmSource: String,
        utmMedium: String,
        utmCampaign: String
    },
    processedAt: Date,
    refundedAt: Date
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            // Hide sensitive information for anonymous donations
            if (ret.isAnonymous) {
                ret.donorName = 'Anonymous';
                delete ret.donorEmail;
            }
            delete ret.__v;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes
donationSchema.index({ donorEmail: 1 });
donationSchema.index({ amount: -1 });
donationSchema.index({ status: 1 });
donationSchema.index({ createdAt: -1 });
donationSchema.index({ transactionId: 1 }, { sparse: true });

// Virtual for formatted amount
donationSchema.virtual('formattedAmount').get(function() {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: this.currency
    }).format(this.amount);
});

// Pre-save middleware
donationSchema.pre('save', function(next) {
    // Generate transaction ID if not provided
    if (!this.transactionId && this.status === 'completed') {
        this.transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }

    // Set processedAt timestamp when status changes to completed
    if (this.isModified('status') && this.status === 'completed' && !this.processedAt) {
        this.processedAt = new Date();
    }

    next();
});

// Static method to get leaderboard
donationSchema.statics.getLeaderboard = async function(limit = 10) {
    return this.aggregate([
        { $match: { status: 'completed', isAnonymous: false } },
        {
            $group: {
                _id: '$donorEmail',
                donorName: { $first: '$donorName' },
                totalAmount: { $sum: '$amount' },
                donationCount: { $sum: 1 },
                lastDonation: { $max: '$createdAt' }
            }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: limit },
        {
            $project: {
                _id: 0,
                donorEmail: '$_id',
                donorName: 1,
                totalAmount: 1,
                donationCount: 1,
                lastDonation: 1,
                formattedTotal: {
                    $concat: ['$', { $toString: '$totalAmount' }]
                }
            }
        }
    ]);
};

// Static method to get donation statistics
donationSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        { $match: { status: 'completed' } },
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

    return stats[0] || {
        totalAmount: 0,
        totalDonations: 0,
        averageAmount: 0,
        maxAmount: 0,
        minAmount: 0
    };
};

// Static method to get donations by date range
donationSchema.statics.getByDateRange = function(startDate, endDate, status = 'completed') {
    return this.find({
        status,
        createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Donation', donationSchema);
