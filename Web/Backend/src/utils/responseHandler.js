/**
 * Standardized response handler utility
 * Provides consistent response format across the API
 */

class ResponseHandler {
    /**
     * Send success response
     * @param {Object} res - Express response object
     * @param {*} data - Response data
     * @param {String} message - Success message
     * @param {Number} statusCode - HTTP status code
     * @param {Object} meta - Additional metadata
     */
    static success(res, data = null, message = 'Success', statusCode = 200, meta = {}) {
        const response = {
            success: true,
            message,
            data,
            timestamp: new Date().toISOString(),
            ...meta
        };

        // Remove null or undefined data
        if (data === null || data === undefined) {
            delete response.data;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send error response
     * @param {Object} res - Express response object
     * @param {String} message - Error message
     * @param {Number} statusCode - HTTP status code
     * @param {Array} errors - Validation errors array
     * @param {Object} meta - Additional metadata
     */
    static error(res, message = 'An error occurred', statusCode = 500, errors = [], meta = {}) {
        const response = {
            success: false,
            message,
            timestamp: new Date().toISOString(),
            ...meta
        };

        // Add errors if provided
        if (errors && errors.length > 0) {
            response.errors = errors;
        }

        // Add error code for easier client handling
        response.errorCode = this.getErrorCode(statusCode);

        return res.status(statusCode).json(response);
    }

    /**
     * Send paginated response
     * @param {Object} res - Express response object
     * @param {Array} data - Array of items
     * @param {Object} pagination - Pagination info
     * @param {String} message - Success message
     */
    static paginated(res, data, pagination, message = 'Data retrieved successfully') {
        const response = {
            success: true,
            message,
            data,
            pagination: {
                page: pagination.page || 1,
                limit: pagination.limit || 10,
                total: pagination.total || data.length,
                totalPages: Math.ceil((pagination.total || data.length) / (pagination.limit || 10)),
                hasNext: pagination.hasNext || false,
                hasPrev: pagination.hasPrev || false
            },
            timestamp: new Date().toISOString()
        };

        // Set pagination headers
        res.set({
            'X-Total-Count': pagination.total || data.length,
            'X-Page-Count': response.pagination.totalPages,
            'X-Current-Page': pagination.page || 1
        });

        return res.status(200).json(response);
    }

    /**
     * Send created resource response
     * @param {Object} res - Express response object
     * @param {*} data - Created resource data
     * @param {String} message - Success message
     */
    static created(res, data, message = 'Resource created successfully') {
        return this.success(res, data, message, 201);
    }

    /**
     * Send no content response
     * @param {Object} res - Express response object
     */
    static noContent(res) {
        return res.status(204).send();
    }

    /**
     * Send not found response
     * @param {Object} res - Express response object
     * @param {String} message - Error message
     */
    static notFound(res, message = 'Resource not found') {
        return this.error(res, message, 404);
    }

    /**
     * Send unauthorized response
     * @param {Object} res - Express response object
     * @param {String} message - Error message
     */
    static unauthorized(res, message = 'Unauthorized access') {
        return this.error(res, message, 401);
    }

    /**
     * Send forbidden response
     * @param {Object} res - Express response object
     * @param {String} message - Error message
     */
    static forbidden(res, message = 'Access forbidden') {
        return this.error(res, message, 403);
    }

    /**
     * Send validation error response
     * @param {Object} res - Express response object
     * @param {Array} errors - Validation errors
     * @param {String} message - Error message
     */
    static validationError(res, errors, message = 'Validation failed') {
        return this.error(res, message, 400, errors);
    }

    /**
     * Send internal server error response
     * @param {Object} res - Express response object
     * @param {String} message - Error message
     */
    static internalError(res, message = 'Internal server error') {
        return this.error(res, message, 500);
    }

    /**
     * Send too many requests response
     * @param {Object} res - Express response object
     * @param {String} message - Error message
     * @param {Number} retryAfter - Retry after seconds
     */
    static tooManyRequests(res, message = 'Too many requests', retryAfter = null) {
        const meta = retryAfter ? { retryAfter } : {};

        if (retryAfter) {
            res.set('Retry-After', retryAfter);
        }

        return this.error(res, message, 429, [], meta);
    }

    /**
     * Get error code based on status code
     * @param {Number} statusCode - HTTP status code
     * @returns {String} Error code
     */
    static getErrorCode(statusCode) {
        const errorCodes = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            405: 'METHOD_NOT_ALLOWED',
            409: 'CONFLICT',
            422: 'UNPROCESSABLE_ENTITY',
            429: 'TOO_MANY_REQUESTS',
            500: 'INTERNAL_SERVER_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE'
        };

        return errorCodes[statusCode] || 'UNKNOWN_ERROR';
    }

    /**
     * Create standardized API response metadata
     * @param {Object} req - Express request object
     * @param {Object} additionalMeta - Additional metadata
     * @returns {Object} Metadata object
     */
    static createMeta(req, additionalMeta = {}) {
        return {
            requestId: req.id,
            apiVersion: req.apiVersion,
            path: req.originalUrl,
            method: req.method,
            ...additionalMeta
        };
    }

    /**
     * Format data with links (HATEOAS style)
     * @param {*} data - Response data
     * @param {Array} links - Array of link objects
     * @returns {Object} Formatted data with links
     */
    static withLinks(data, links = []) {
        return {
            ...data,
            _links: links.reduce((acc, link) => {
                acc[link.rel] = {
                    href: link.href,
                    method: link.method || 'GET'
                };
                return acc;
            }, {})
        };
    }
}

module.exports = ResponseHandler;
