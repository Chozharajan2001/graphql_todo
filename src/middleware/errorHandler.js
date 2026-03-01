/**
 * Error Handling Middleware
 * Provides comprehensive error handling for the application
 */

class ErrorHandler {
  /**
   * Main error handling middleware
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  handleError() {
    return (err, req, res, next) => {
      // Log error details
      this.logError(err, req);

      // Handle different types of errors
      if (err.name === 'ValidationError') {
        return this.handleValidationError(err, res);
      }
      
      if (err.name === 'CastError') {
        return this.handleCastError(err, res);
      }
      
      if (err.code === 11000) {
        return this.handleDuplicateKeyError(err, res);
      }
      
      if (err.name === 'JsonWebTokenError') {
        return this.handleJWTError(err, res);
      }
      
      if (err.name === 'TokenExpiredError') {
        return this.handleTokenExpiredError(err, res);
      }
      
      if (err.name === 'UnauthorizedError') {
        return this.handleUnauthorizedError(err, res);
      }
      
      // Handle custom application errors
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code || 'APPLICATION_ERROR',
          ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
      }
      
      // Default server error
      return this.handleServerError(err, res);
    };
  }

  /**
   * Handle Mongoose validation errors
   * @param {Error} err - ValidationError object
   * @param {Object} res - Express response object
   */
  handleValidationError(err, res) {
    const errors = Object.values(err.errors).map(e => e.message);
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      code: 'VALIDATION_ERROR'
    });
  }

  /**
   * Handle Mongoose cast errors (invalid ObjectId, etc.)
   * @param {Error} err - CastError object
   * @param {Object} res - Express response object
   */
  handleCastError(err, res) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input format',
      errors: [`Invalid ${err.path}: ${err.value}`],
      code: 'CAST_ERROR'
    });
  }

  /**
   * Handle MongoDB duplicate key errors
   * @param {Error} err - Duplicate key error object
   * @param {Object} res - Express response object
   */
  handleDuplicateKeyError(err, res) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry',
      errors: [`${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`],
      code: 'DUPLICATE_KEY'
    });
  }

  /**
   * Handle JWT verification errors
   * @param {Error} err - JsonWebTokenError object
   * @param {Object} res - Express response object
   */
  handleJWTError(err, res) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  /**
   * Handle expired JWT tokens
   * @param {Error} err - TokenExpiredError object
   * @param {Object} res - Express response object
   */
  handleTokenExpiredError(err, res) {
    return res.status(401).json({
      success: false,
      message: 'Token has expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  /**
   * Handle unauthorized access errors
   * @param {Error} err - UnauthorizedError object
   * @param {Object} res - Express response object
   */
  handleUnauthorizedError(err, res) {
    return res.status(401).json({
      success: false,
      message: err.message || 'Unauthorized access',
      code: 'UNAUTHORIZED'
    });
  }

  /**
   * Handle server errors (500)
   * @param {Error} err - Error object
   * @param {Object} res - Express response object
   */
  handleServerError(err, res) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { 
        error: err.message,
        stack: err.stack 
      })
    });
  }

  /**
   * Handle 404 Not Found errors
   * @returns {Function} Express middleware
   */
  handleNotFound() {
    return (req, res) => {
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        code: 'NOT_FOUND'
      });
    };
  }

  /**
   * Async error wrapper for async route handlers
   * @param {Function} fn - Async function to wrap
   * @returns {Function} Wrapped function
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Create custom application error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Error code
   * @returns {Error} Custom error object
   */
  createError(message, statusCode = 500, code = 'APPLICATION_ERROR') {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
  }

  /**
   * Log error details
   * @param {Error} err - Error object
   * @param {Object} req - Request object
   */
  logError(err, req) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: err.message,
      stack: err.stack,
      url: req?.originalUrl,
      method: req?.method,
      ip: req?.ip,
      userAgent: req?.get('User-Agent'),
      userId: req?.userId
    };

    // Different log levels based on error severity
    if (err.statusCode >= 500) {
      console.error('🚨 SERVER ERROR:', JSON.stringify(errorInfo, null, 2));
    } else if (err.statusCode >= 400) {
      console.warn('⚠️  CLIENT ERROR:', JSON.stringify(errorInfo, null, 2));
    } else {
      console.log('ℹ️  APPLICATION ERROR:', JSON.stringify(errorInfo, null, 2));
    }
  }

  /**
   * Global unhandled promise rejection handler
   */
  setupGlobalHandlers() {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit process, but log the error
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      // In production, you might want to exit gracefully
      // process.exit(1);
    });

    // Handle SIGTERM for graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      // Perform cleanup operations here
    });
  }

  /**
   * Format error response based on environment
   * @param {Error} err - Error object
   * @param {boolean} isDevelopment - Development environment flag
   * @returns {Object} Formatted error response
   */
  formatErrorResponse(err, isDevelopment = process.env.NODE_ENV === 'development') {
    const response = {
      success: false,
      message: err.message || 'An error occurred',
      code: err.code || 'UNKNOWN_ERROR'
    };

    if (isDevelopment && err.stack) {
      response.stack = err.stack;
    }

    if (err.errors && Array.isArray(err.errors)) {
      response.errors = err.errors;
    }

    return response;
  }

  /**
   * Handle database connection errors
   * @param {Error} err - Database error
   * @param {Object} res - Response object
   */
  handleDatabaseError(err, res) {
    console.error('Database Error:', err);
    
    return res.status(503).json({
      success: false,
      message: 'Database connection failed',
      code: 'DATABASE_ERROR'
    });
  }

  /**
   * Handle rate limiting errors
   * @param {Error} err - Rate limit error
   * @param {Object} res - Response object
   */
  handleRateLimitError(err, res) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: err.retryAfter
    });
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Export error handling methods
export const {
  handleError,
  handleNotFound,
  asyncHandler,
  createError,
  setupGlobalHandlers,
  formatErrorResponse,
  handleDatabaseError,
  handleRateLimitError
} = errorHandler;

// Export the class and instance
export { ErrorHandler };
export default errorHandler;