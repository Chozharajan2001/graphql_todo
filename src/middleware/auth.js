import { verifyToken, extractUserId, isTokenExpired, isTokenBlacklisted } from '../utils/jwt.js';
import User from '../models/User.js';

/**
 * Authentication Middleware
 * Provides comprehensive authentication and authorization functionality
 */

class AuthMiddleware {
  /**
   * Require authentication for protected routes
   * @returns {Function} Express middleware
   */
  requireAuth() {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.',
            code: 'MISSING_TOKEN'
          });
        }

        // Check if token is blacklisted
        if (await isTokenBlacklisted(token)) {
          return res.status(401).json({
            success: false,
            message: 'Token has been revoked.',
            code: 'TOKEN_REVOKED'
          });
        }

        // Verify token
        const decoded = verifyToken(token);
        
        // Check token type
        if (decoded.type !== 'access') {
          return res.status(401).json({
            success: false,
            message: 'Invalid token type.',
            code: 'INVALID_TOKEN_TYPE'
          });
        }

        // Find user
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found.',
            code: 'USER_NOT_FOUND'
          });
        }

        // Check if user account is active
        if (!user.isActive) {
          return res.status(401).json({
            success: false,
            message: 'Account is deactivated.',
            code: 'ACCOUNT_DEACTIVATED'
          });
        }

        // Attach user to request
        req.user = user;
        req.userId = user._id.toString();
        
        next();
      } catch (error) {
        this.handleAuthError(error, res);
      }
    };
  }

  /**
   * Optional authentication (doesn't fail if no token)
   * @returns {Function} Express middleware
   */
  optionalAuth() {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          req.user = null;
          req.userId = null;
          return next();
        }

        // Check if token is expired
        if (isTokenExpired(token)) {
          req.user = null;
          req.userId = null;
          return next();
        }

        // Check if token is blacklisted
        if (await isTokenBlacklisted(token)) {
          req.user = null;
          req.userId = null;
          return next();
        }

        // Verify token
        const decoded = verifyToken(token);
        
        // Check token type
        if (decoded.type !== 'access') {
          req.user = null;
          req.userId = null;
          return next();
        }

        // Find user
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user || !user.isActive) {
          req.user = null;
          req.userId = null;
          return next();
        }

        // Attach user to request
        req.user = user;
        req.userId = user._id.toString();
        
        next();
      } catch (error) {
        // Silently fail for optional auth
        req.user = null;
        req.userId = null;
        next();
      }
    };
  }

  /**
   * Require specific user roles/permissions
   * @param {...string} roles - Required roles
   * @returns {Function} Express middleware
   */
  requireRoles(...roles) {
    return [this.requireAuth(), (req, res, next) => {
      try {
        // Check if user has required roles
        // This assumes your User model has a roles field
        const userRoles = req.user.roles || [];
        const hasRequiredRole = roles.some(role => userRoles.includes(role));
        
        if (!hasRequiredRole) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions.',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
        
        next();
      } catch (error) {
        this.handleAuthError(error, res);
      }
    }];
  }

  /**
   * Require ownership of resource
   * @param {string} resourceIdParam - Parameter name containing resource ID
   * @param {Function} getResourceOwner - Function to get resource owner ID
   * @returns {Function} Express middleware
   */
  requireOwnership(resourceIdParam, getResourceOwner) {
    return [this.requireAuth(), async (req, res, next) => {
      try {
        const resourceId = req.params[resourceIdParam] || req.body[resourceIdParam];
        
        if (!resourceId) {
          return res.status(400).json({
            success: false,
            message: 'Resource ID is required.',
            code: 'MISSING_RESOURCE_ID'
          });
        }

        // Get resource owner
        const ownerId = await getResourceOwner(resourceId);
        
        if (!ownerId) {
          return res.status(404).json({
            success: false,
            message: 'Resource not found.',
            code: 'RESOURCE_NOT_FOUND'
          });
        }

        // Check ownership
        if (ownerId.toString() !== req.userId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You do not own this resource.',
            code: 'ACCESS_DENIED'
          });
        }
        
        next();
      } catch (error) {
        this.handleAuthError(error, res);
      }
    }];
  }

  /**
   * Rate limiting for authentication attempts
   * @param {number} maxAttempts - Maximum attempts allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Function} Express middleware
   */
  rateLimitAuth(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    const attempts = new Map();
    
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean old attempts
      if (attempts.has(ip)) {
        const ipAttempts = attempts.get(ip);
        const validAttempts = ipAttempts.filter(attempt => attempt > windowStart);
        attempts.set(ip, validAttempts);
      } else {
        attempts.set(ip, []);
      }
      
      const ipAttempts = attempts.get(ip);
      
      if (ipAttempts.length >= maxAttempts) {
        return res.status(429).json({
          success: false,
          message: 'Too many authentication attempts. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: new Date(windowStart + windowMs).toISOString()
        });
      }
      
      // Record this attempt
      ipAttempts.push(now);
      next();
    };
  }

  /**
   * Extract token from request
   * @param {Object} req - Express request object
   * @returns {string|null} Token or null
   */
  extractToken(req) {
    // Check headers
    if (req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
    }
    
    // Check query parameters
    if (req.query.token) {
      return req.query.token;
    }
    
    // Check body
    if (req.body && req.body.token) {
      return req.body.token;
    }
    
    return null;
  }

  /**
   * Handle authentication errors
   * @param {Error} error - Error object
   * @param {Object} res - Express response object
   */
  handleAuthError(error, res) {
    console.error('Authentication error:', error.message);
    
    switch (error.message) {
      case 'Token has expired':
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      
      case 'Invalid token':
        return res.status(401).json({
          success: false,
          message: 'Invalid token provided.',
          code: 'INVALID_TOKEN'
        });
      
      case 'Token verification failed':
        return res.status(401).json({
          success: false,
          message: 'Token verification failed.',
          code: 'TOKEN_VERIFICATION_FAILED'
        });
      
      default:
        return res.status(401).json({
          success: false,
          message: 'Authentication failed.',
          code: 'AUTHENTICATION_FAILED'
        });
    }
  }

  /**
   * Logout user (invalidate token)
   * @param {string} token - Token to invalidate
   * @returns {Promise<void>}
   */
  async logout(token) {
    if (token) {
      try {
        await blacklistToken(token);
      } catch (error) {
        console.error('Error blacklisting token:', error.message);
      }
    }
  }

  /**
   * Get current user information
   * @param {Object} req - Express request object
   * @returns {Object|null} User object or null
   */
  getCurrentUser(req) {
    return req.user || null;
  }

  /**
   * Check if user is authenticated
   * @param {Object} req - Express request object
   * @returns {boolean} Authentication status
   */
  isAuthenticated(req) {
    return !!req.user;
  }

  /**
   * Check if user has specific role
   * @param {Object} req - Express request object
   * @param {string} role - Role to check
   * @returns {boolean} Role membership status
   */
  hasRole(req, role) {
    if (!req.user) return false;
    const userRoles = req.user.roles || [];
    return userRoles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   * @param {Object} req - Express request object
   * @param {...string} roles - Roles to check
   * @returns {boolean} Role membership status
   */
  hasAnyRole(req, ...roles) {
    if (!req.user) return false;
    const userRoles = req.user.roles || [];
    return roles.some(role => userRoles.includes(role));
  }
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

// Export middleware methods
export const {
  requireAuth,
  optionalAuth,
  requireRoles,
  requireOwnership,
  rateLimitAuth,
  extractToken,
  handleAuthError,
  logout,
  getCurrentUser,
  isAuthenticated,
  hasRole,
  hasAnyRole
} = authMiddleware;

// Export the class and instance
export { AuthMiddleware };
export default authMiddleware;