const mongoose = require('mongoose');
const config = require('./environment');

class Database {
    constructor() {
        this.isConnected = false;
        this.connection = null;
        this.retryAttempts = 0;
        this.maxRetries = 5;
    }

    async connect(retryDelay = 5000) {
        try {
            if (this.isConnected) {
                console.log('⚠️  Database already connected');
                return this.connection;
            }

            console.log(`🔄 Attempting to connect to MongoDB (attempt ${this.retryAttempts + 1}/${this.maxRetries})...`);
            console.log(`📍 Connection URI: ${config.MONGODB.URI.replace(/\/\/.*@/, '//***:***@')}`);

            // Updated MongoDB connection options (removed deprecated options)
            const options = {
                // Core connection options
                useNewUrlParser: true,
                useUnifiedTopology: true,

                // Connection pool settings
                maxPoolSize: 10, // Maintain up to 10 socket connections
                minPoolSize: 2,  // Maintain at least 2 socket connections
                maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity

                // Timeout settings
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
                connectTimeoutMS: 10000, // Give up initial connection after 10 seconds

                // Retry and reliability
                retryWrites: true, // Retry failed writes
                retryReads: true,  // Retry failed reads

                // Heartbeat settings
                heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds

                // Add authentication if credentials are provided
                ...(config.MONGODB.USER && config.MONGODB.PASSWORD && {
                    auth: {
                        username: config.MONGODB.USER,
                        password: config.MONGODB.PASSWORD
                    },
                    authSource: 'admin'
                })
            };

            // Set up connection event listeners before connecting
            this.setupEventListeners();

            this.connection = await mongoose.connect(config.MONGODB.URI, options);
            this.isConnected = true;
            this.retryAttempts = 0;

            console.log('✅ MongoDB connected successfully');
            console.log(`📊 Connection details:`, {
                host: mongoose.connection.host,
                port: mongoose.connection.port,
                database: mongoose.connection.name,
                readyState: mongoose.connection.readyState
            });

            return this.connection;

        } catch (error) {
            console.error(`❌ MongoDB connection error (attempt ${this.retryAttempts + 1}):`, error.message);

            this.retryAttempts++;

            if (this.retryAttempts < this.maxRetries) {
                console.log(`⏳ Retrying connection in ${retryDelay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return this.connect(retryDelay * 1.5); // Exponential backoff
            } else {
                console.error('💀 Max retry attempts reached. Exiting...');
                throw error;
            }
        }
    }

    setupEventListeners() {
        mongoose.connection.on('connected', () => {
            console.log('📡 Mongoose connected to MongoDB');
            this.isConnected = true;
        });

        mongoose.connection.on('error', (err) => {
            console.error('🚨 Mongoose connection error:', err.message);
            this.isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  Mongoose disconnected from MongoDB');
            this.isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            console.log('🔄 Mongoose reconnected to MongoDB');
            this.isConnected = true;
        });

        // Handle application termination
        process.on('SIGINT', async () => {
            console.log('🛑 Received SIGINT, closing database connection...');
            await this.disconnect();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('🛑 Received SIGTERM, closing database connection...');
            await this.disconnect();
            process.exit(0);
        });
    }

    async disconnect() {
        try {
            if (this.isConnected) {
                await mongoose.connection.close();
                this.isConnected = false;
                console.log('🔌 MongoDB connection closed');
            }
        } catch (error) {
            console.error('❌ Error closing MongoDB connection:', error);
            throw error;
        }
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name,
            states: {
                0: 'disconnected',
                1: 'connected', 
                2: 'connecting',
                3: 'disconnecting'
            }[mongoose.connection.readyState]
        };
    }

    // Add connection health check
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected' };
            }

            // Simple ping to check if database is responsive
            await mongoose.connection.db.admin().ping();
            return { 
                status: 'healthy',
                details: this.getConnectionStatus()
            };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                error: error.message,
                details: this.getConnectionStatus()
            };
        }
    }
}

module.exports = new Database();