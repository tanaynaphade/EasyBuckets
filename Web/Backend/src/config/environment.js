const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Required environment variables
const requiredEnvVars = [
    'JWT_SECRET'
];

// Check for missing required variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
}

// Validate JWT_SECRET length
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters long');
    process.exit(1);
}

const config = {
    // Server Configuration
    PORT: parseInt(process.env.PORT, 10) || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // MongoDB Configuration (FIXED - removed deprecated options)
    MONGODB: {
        URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/nba_analytics',
        USER: process.env.MONGODB_USER,
        PASSWORD: process.env.MONGODB_PASSWORD
        // Removed the OPTIONS object with deprecated bufferMaxEntries
    },

    // JWT Configuration
    JWT: {
        SECRET: process.env.JWT_SECRET,
        EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
        REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
        REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },

    // Security Configuration
    SECURITY: {
        BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
        RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
        RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000']
    },

    // Logging Configuration
    LOGGING: {
        LEVEL: process.env.LOG_LEVEL || 'info',
        FILE_PATH: path.join(process.cwd(), 'logs')
    }
};

// Validation functions
config.isProduction = () => config.NODE_ENV === 'production';
config.isDevelopment = () => config.NODE_ENV === 'development';
config.isTest = () => config.NODE_ENV === 'test';

// Log configuration on startup (but not secrets)
console.log('🔧 Configuration loaded:');
console.log(`   NODE_ENV: ${config.NODE_ENV}`);
console.log(`   PORT: ${config.PORT}`);
console.log(`   MONGODB_URI: ${config.MONGODB.URI.replace(/\/\/.*@/, '//***:***@')}`);
console.log(`   JWT_SECRET: ${config.JWT.SECRET ? '[SET]' : '[NOT SET]'}`);

module.exports = config;