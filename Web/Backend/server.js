const app = require('./app');
const config = require('./src/config/environment');
const logger = require('./src/utils/logger');
const { gracefulShutdown } = require('./src/utils/errorHandler');

const PORT = config.PORT;

// Start server
const server = app.listen(PORT, () => {
    logger.info(`🚀 NBA Analytics Backend Server running on port ${PORT}`);
    logger.info(`📊 Environment: ${config.NODE_ENV}`);
    logger.info(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    logger.info(`📖 API Docs: http://localhost:${PORT}/api/docs`);

    if (config.isDevelopment()) {
        logger.info(`🐛 Development mode enabled`);
        logger.info(`📝 Detailed logging enabled`);
    }
});

// Handle server startup errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        logger.error('❌ Server startup error:', error);
        process.exit(1);
    }
});

// Setup graceful shutdown
gracefulShutdown(server);

// Export server for testing
module.exports = server;
