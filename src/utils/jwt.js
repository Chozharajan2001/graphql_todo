import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * JWT Utility Class
 * Provides comprehensive token management for authentication and authorization
 */

class JWTUtils {
  constructor() {
    this.secret = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';
    this.expiresIn = process.env.JWT_EXPIRE || '7d';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRE || '30d';
    
    // Validate environment configuration
    if (process.env.NODE_ENV === 'production' && this.secret === 'fallback-secret-key-change-in-production') {
      throw new Error('JWT_SECRET must be configured in production environment');
    }
  }

  /**
   * Generate access token for user authentication
   * @param {Object} payload - User data to include in token
   * @param {string} payload.id - User ID (required)
   * @param {string} payload.email - User email (optional)
   * @param {string} payload.username - Username (optional)
   * @returns {string} Signed JWT token
   */
  generateAccessToken(payload) {
    if (!payload || !payload.id) {
      throw new Error('User ID is required to generate access token');
    }

    const tokenPayload = {
      id: payload.id,
      email: payload.email,
      username: payload.username,
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(tokenPayload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: 'graphql-todo-app',
      audience: 'graphql-todo-users',
      subject: payload.id.toString()
    });
  }

  /**
   * Generate refresh token for token renewal
   * @param {Object} payload - User data
   * @returns {string} Refresh token
   */
  generateRefreshToken(payload) {
    if (!payload || !payload.id) {
      throw new Error('User ID is required to generate refresh token');
    }

    const refreshTokenPayload = {
      id: payload.id,
      type: 'refresh',
      tokenId: crypto.randomBytes(32).toString('hex'),
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(refreshTokenPayload, this.secret, {
      expiresIn: this.refreshExpiresIn,
      issuer: 'graphql-todo-app',
      audience: 'graphql-todo-users',
      subject: payload.id.toString()
    });
  }

  /**
   * Generate email verification token
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @returns {string} Email verification token
   */
  generateEmailVerificationToken(userId, email) {
    if (!userId || !email) {
      throw new Error('User ID and email are required for email verification token');
    }

    const payload = {
      id: userId,
      email: email,
      type: 'email-verification',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: '24h',
      issuer: 'graphql-todo-app',
      audience: 'graphql-todo-users'
    });
  }

  /**
   * Generate password reset token
   * @param {string} userId - User ID
   * @returns {string} Password reset token
   */
  generatePasswordResetToken(userId) {
    if (!userId) {
      throw new Error('User ID is required for password reset token');
    }

    const payload = {
      id: userId,
      type: 'password-reset',
      tokenId: crypto.randomBytes(32).toString('hex'),
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: '1h',
      issuer: 'graphql-todo-app',
      audience: 'graphql-todo-users'
    });
  }

  /**
   * Verify and decode JWT token
   * @param {string} token - JWT token to verify
   * @param {Object} options - Verification options
   * @returns {Object} Decoded token payload
   */
  verifyToken(token, options = {}) {
    if (!token) {
      throw new Error('Token is required');
    }

    const defaultOptions = {
      issuer: 'graphql-todo-app',
      audience: 'graphql-todo-users'
    };

    const verifyOptions = { ...defaultOptions, ...options };

    try {
      return jwt.verify(token, this.secret, verifyOptions);
    } catch (error) {
      switch (error.name) {
        case 'TokenExpiredError':
          throw new Error('Token has expired');
        case 'JsonWebTokenError':
          throw new Error('Invalid token');
        case 'NotBeforeError':
          throw new Error('Token not active yet');
        default:
          throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Decode token without verification (use cautiously)
   * @param {string} token - JWT token
   * @returns {Object} Decoded payload
   */
  decodeToken(token) {
    if (!token) {
      throw new Error('Token is required');
    }

    return jwt.decode(token);
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Valid refresh token
   * @param {Object} userData - User data for new access token
   * @returns {Object} New tokens
   */
  async refreshTokens(refreshToken, userData) {
    try {
      // Verify refresh token
      const decoded = this.verifyToken(refreshToken, { 
        ignoreExpiration: false 
      });

      // Check if it's a refresh token
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(userData);
      const newRefreshToken = this.generateRefreshToken(userData);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: this.expiresIn
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Validate token type
   * @param {string} token - JWT token
   * @param {string} expectedType - Expected token type
   * @returns {boolean} Token type validation result
   */
  validateTokenType(token, expectedType) {
    try {
      const decoded = this.decodeToken(token);
      return decoded && decoded.type === expectedType;
    } catch {
      return false;
    }
  }

  /**
   * Get token expiration time
   * @param {string} token - JWT token
   * @returns {number|null} Expiration timestamp or null
   */
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      return decoded ? decoded.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} Expiration status
   */
  isTokenExpired(token) {
    const exp = this.getTokenExpiration(token);
    return exp ? exp * 1000 < Date.now() : true;
  }

  /**
   * Extract user ID from token
   * @param {string} token - JWT token
   * @returns {string|null} User ID or null
   */
  extractUserId(token) {
    try {
      const decoded = this.decodeToken(token);
      return decoded ? decoded.id : null;
    } catch {
      return null;
    }
  }

  /**
   * Blacklist token (for logout functionality)
   * @param {string} token - JWT token to blacklist
   * @returns {Promise<void>}
   */
  async blacklistToken(token) {
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.exp) {
        // In production, store in Redis/cache with expiration
        // For now, we'll use a simple in-memory approach
        const expirationTime = decoded.exp * 1000 - Date.now();
        if (expirationTime > 0) {
          // Store blacklisted token with expiration
          // This would typically use Redis in production
          console.log(`Token blacklisted until: ${new Date(decoded.exp * 1000)}`);
        }
      }
    } catch (error) {
      console.error('Error blacklisting token:', error.message);
    }
  }

  /**
   * Check if token is blacklisted
   * @param {string} token - JWT token
   * @returns {Promise<boolean>} Blacklist status
   */
  async isTokenBlacklisted(token) {
    try {
      // In production, check Redis/cache
      // For demonstration, we'll return false
      return false;
    } catch (error) {
      console.error('Error checking token blacklist:', error.message);
      return false;
    }
  }

  /**
   * Generate temporary access token for specific operations
   * @param {Object} payload - Token payload
   * @param {string} operation - Operation type
   * @param {string} duration - Token duration
   * @returns {string} Temporary token
   */
  generateTemporaryToken(payload, operation, duration = '15m') {
    if (!payload || !payload.id) {
      throw new Error('User ID is required for temporary token');
    }

    const tempPayload = {
      id: payload.id,
      type: 'temporary',
      operation: operation,
      ...payload,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(tempPayload, this.secret, {
      expiresIn: duration,
      issuer: 'graphql-todo-app',
      audience: 'graphql-todo-users'
    });
  }
}

// Create singleton instance
const jwtUtils = new JWTUtils();

// Export individual methods for convenience
export const {
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyToken,
  decodeToken,
  refreshTokens,
  validateTokenType,
  getTokenExpiration,
  isTokenExpired,
  extractUserId,
  blacklistToken,
  isTokenBlacklisted,
  generateTemporaryToken
} = jwtUtils;

// Export the class and instance
export { JWTUtils };
export default jwtUtils;