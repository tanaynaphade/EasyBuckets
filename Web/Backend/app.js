const express = require('express');
const morgan = require('morgan');
const config = require('./src/config/environment');
const database = require('./src/config/database');
const routes = require('./src/routes');
const { globalErrorHandler, notFoundHandler } = require('./src/utils/errorHandler');
const logger = require('./src/utils/logger');

// Security middleware
const {
    securityHeaders,
    cors,
    compression,
    requestLogger,
    ipSecurity,
    validateContentType,
    requestSizeLimiter,
    apiVersioning,
    requestTimeout
} = require('./src/middleware/security');

// Create Express app
const app = express();

// Trust proxy (important for rate limiting and IP detection when behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(securityHeaders);
app.use(cors);
app.use(compression);
app.use(ipSecurity);
app.use(requestTimeout(30000)); // 30 second timeout
app.use(requestSizeLimiter('10mb'));

// Request logging
if (config.isProduction()) {
    app.use(morgan('combined', { stream: logger.stream }));
} else {
    app.use(morgan('dev'));
}
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
}));

// Content type validation
app.use(validateContentType(['application/json', 'application/x-www-form-urlencoded']));

// API versioning
app.use(apiVersioning);

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'NBA Analytics Dashboard API',
        version: '1.0.0',
        environment: config.NODE_ENV,
        timestamp: new Date().toISOString(),
        documentation: '/api/docs',
        health: '/api/health'
    });
});

// API routes
app.use('/api', routes);

// Handle 404 errors
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// Database connection
const connectDatabase = async () => {
    try {
        await database.connect();
        logger.info('✅ Database connected successfully');
    } catch (error) {
        logger.error('❌ Database connection failed:', error);
        process.exit(1);
    }
};

// Initialize database connection if not in test environment
if (process.env.NODE_ENV !== 'test') {
    connectDatabase();
}

// Handle process termination gracefully
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await database.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await database.disconnect();
    process.exit(0);
});

module.exports = app;
