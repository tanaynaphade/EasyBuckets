const express = require('express');
const authRoutes = require('./authRoutes');
const donationRoutes = require('./donationRoutes');
const testimonialRoutes = require('./testimonialRoutes');
const { generalLimiter } = require('../middleware/rateLimiter');
const ResponseHandler = require('../utils/responseHandler');
const { NotFoundError } = require('../utils/errorHandler');

const router = express.Router();

// Apply general rate limiting to all API routes
router.use(generalLimiter);

// API health check
router.get('/health', (req, res) => {
    const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: '1.0.0',
        services: {
            database: 'connected', // This would check actual DB status in production
            redis: 'not_configured',
            external_apis: 'not_configured'
        }
    };

    ResponseHandler.success(res, healthCheck, 'Service is healthy');
});

// API documentation endpoint
router.get('/docs', (req, res) => {
    const apiDocs = {
        name: 'NBA Analytics Dashboard API',
        version: '1.0.0',
        description: 'Backend API for NBA Analytics Dashboard with donations and testimonials',
        endpoints: {
            auth: {
                base: '/api/auth',
                description: 'User authentication and profile management',
                endpoints: [
                    'POST /register - Register new user',
                    'POST /login - User login', 
                    'POST /logout - User logout',
                    'GET /profile - Get user profile',
                    'PUT /profile - Update user profile',
                    'POST /change-password - Change password'
                ]
            },
            donations: {
                base: '/api/donations',
                description: 'Donation management and leaderboard',
                endpoints: [
                    'POST / - Submit donation',
                    'GET / - Get donations (auth required)',
                    'GET /leaderboard - Get donation leaderboard',
                    'GET /stats - Get donation statistics'
                ]
            },
            testimonials: {
                base: '/api/testimonials',
                description: 'User testimonials and reviews',
                endpoints: [
                    'POST / - Submit testimonial',
                    'GET / - Get testimonials',
                    'GET /approved - Get approved testimonials',
                    'GET /featured - Get featured testimonials',
                    'GET /stats/ratings - Get rating statistics'
                ]
            }
        },
        authentication: {
            type: 'JWT Bearer Token',
            header: 'Authorization: Bearer <token>'
        },
        rateLimit: {
            general: '100 requests per 15 minutes',
            auth: '5 requests per 15 minutes',
            donations: '10 requests per hour',
            testimonials: '2 requests per hour'
        }
    };

    ResponseHandler.success(res, apiDocs, 'API documentation retrieved');
});

// Route definitions
router.use('/auth', authRoutes);
router.use('/donations', donationRoutes);
router.use('/testimonials', testimonialRoutes);

// API status endpoint with database connectivity check
router.get('/status', async (req, res) => {
    try {
        const database = require('../config/database');
        const dbStatus = database.getConnectionStatus();

        const status = {
            api: 'running',
            database: dbStatus.isConnected ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: `${Math.floor(process.uptime())} seconds`,
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
            },
            environment: process.env.NODE_ENV
        };

        ResponseHandler.success(res, status, 'System status retrieved');
    } catch (error) {
        ResponseHandler.error(res, 'Error retrieving system status', 500);
    }
});

// API metrics endpoint (simple implementation)
router.get('/metrics', (req, res) => {
    const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform,
        architecture: process.arch
    };

    ResponseHandler.success(res, metrics, 'System metrics retrieved');
});

// Catch-all route for undefined endpoints
router.all('*', (req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

module.exports = router;
