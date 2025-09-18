const logger = require('./logger');
const ResponseHandler = require('./responseHandler');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
    constructor(message, statusCode = 500, errors = []) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.errors = errors;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation error class
 */
class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, 400, errors);
        this.name = 'ValidationError';
    }
}

/**
 * Authentication error class
 */
class AuthError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
        this.name = 'AuthError';
    }
}

/**
 * Authorization error class
 */
class AuthorizationError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, 403);
        this.name = 'AuthorizationError';
    }
}

/**
 * Not found error class
 */
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
        this.name = 'NotFoundError';
    }
}

/**
 * Conflict error class
 */
class ConflictError extends AppError {
    constructor(message = 'Resource conflict') {
        super(message, 409);
        this.name = 'ConflictError';
    }
}

/**
 * Handle cast errors (invalid MongoDB ObjectId)
 */
const handleCastErrorDB = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400);
};

/**
 * Handle duplicate field errors (MongoDB duplicate key)
 */
const handleDuplicateFieldsDB = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field} '${value}' already exists`;

    return new ConflictError(message);
};

/**
 * Handle validation errors (Mongoose validation)
 */
const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message,
        value: error.value
    }));

    return new ValidationError('Invalid input data', errors);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => {
    return new AuthError('Invalid token. Please log in again');
};

/**
 * Handle JWT expired errors
 */
const handleJWTExpiredError = () => {
    return new AuthError('Token has expired. Please log in again');
};

/**
 * Send error response in development
 */
const sendErrorDev = (err, res) => {
    const response = {
        success: false,
        error: {
            name: err.name,
            message: err.message,
            statusCode: err.statusCode,
            stack: err.stack,
            ...(err.errors && err.errors.length > 0 && { errors: err.errors })
        },
        timestamp: new Date().toISOString()
    };

    return res.status(err.statusCode || 500).json(response);
};

/**
 * Send error response in production
 */
const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        return ResponseHandler.error(
            res, 
            err.message, 
            err.statusCode,
            err.errors
        );
    }

    // Programming or other unknown error: don't leak error details
    logger.error('Unexpected error:', {
        name: err.name,
        message: err.message,
        stack: err.stack
    });

    return ResponseHandler.internalError(res, 'Something went wrong');
};

/**
 * Global error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error details
    logger.error(`Error ${err.statusCode}: ${err.message}`, {
        error: err.name,
        statusCode: err.statusCode,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        stack: err.stack
    });

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        let error = { ...err };
        error.message = err.message;

        // Handle specific error types
        if (error.name === 'CastError') {
            error = handleCastErrorDB(error);
        }
        if (error.code === 11000) {
            error = handleDuplicateFieldsDB(error);
        }
        if (error.name === 'ValidationError') {
            error = handleValidationErrorDB(error);
        }
        if (error.name === 'JsonWebTokenError') {
            error = handleJWTError();
        }
        if (error.name === 'TokenExpiredError') {
            error = handleJWTExpiredError();
        }

        sendErrorProd(error, res);
    }
};

/**
 * Handle 404 errors for undefined routes
 */
const notFoundHandler = (req, res, next) => {
    const message = `Route ${req.originalUrl} not found`;
    next(new NotFoundError(message));
};

/**
 * Async error wrapper
 * Catches errors from async functions and passes them to error handler
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (err, promise) => {
    logger.error('Unhandled Promise Rejection:', {
        error: err.message,
        stack: err.stack,
        promise
    });

    // Close server gracefully
    process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', {
        error: err.message,
        stack: err.stack
    });

    process.exit(1);
});

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = (server) => {
    const signals = ['SIGTERM', 'SIGINT'];

    signals.forEach(signal => {
        process.on(signal, () => {
            logger.info(`Received ${signal}, starting graceful shutdown...`);

            server.close(() => {
                logger.info('Process terminated gracefully');
                process.exit(0);
            });

            // Force close after 30 seconds
            setTimeout(() => {
                logger.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 30000);
        });
    });
};

module.exports = {
    AppError,
    ValidationError,
    AuthError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    globalErrorHandler,
    notFoundHandler,
    asyncHandler,
    gracefulShutdown
};
