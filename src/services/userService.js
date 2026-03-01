import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken, generateEmailVerificationToken } from '../utils/jwt.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * User Service
 * Handles all user-related business logic and operations
 */

class UserService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.username - Username
   * @param {string} userData.email - Email address
   * @param {string} userData.password - Password
   * @param {string} userData.firstName - First name (optional)
   * @param {string} userData.lastName - Last name (optional)
   * @returns {Promise<Object>} Registered user with tokens
   */
  async register(userData) {
    const { username, email, password, firstName, lastName } = userData;

    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
      });

      if (existingUser) {
        if (existingUser.email.toLowerCase() === email.toLowerCase()) {
          throw createError('Email already registered', 409, 'EMAIL_EXISTS');
        }
        if (existingUser.username.toLowerCase() === username.toLowerCase()) {
          throw createError('Username already taken', 409, 'USERNAME_EXISTS');
        }
      }

      // Create new user
      const user = new User({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password,
        firstName,
        lastName
      });

      await user.save();

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user._id,
        email: user.email,
        username: user.username
      });

      const refreshToken = generateRefreshToken({
        id: user._id
      });

      // Generate email verification token (optional)
      const emailVerificationToken = generateEmailVerificationToken(user._id, user.email);

      // Update user with verification token
      user.emailVerificationToken = emailVerificationToken;
      await user.save();

      // Return user data without sensitive information
      const userResponse = user.toJSON();
      
      return {
        success: true,
        message: 'User registered successfully',
        data: {
          user: userResponse,
          tokens: {
            accessToken,
            refreshToken,
            tokenType: 'Bearer'
          },
          emailVerificationToken
        }
      };
    } catch (error) {
      // Re-throw custom errors, handle database errors
      if (error.code === 'EMAIL_EXISTS' || error.code === 'USERNAME_EXISTS') {
        throw error;
      }
      
      // Handle database validation errors
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(e => e.message);
        throw createError(errors.join(', '), 400, 'VALIDATION_ERROR');
      }
      
      throw error;
    }
  }

  /**
   * Authenticate user login
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise<Object>} Authenticated user with tokens
   */
  async login(credentials) {
    const { email, password } = credentials;

    try {
      // Find user by email (case insensitive)
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      // Check if user exists
      if (!user) {
        throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Check if account is active
      if (!user.isActive) {
        throw createError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user._id,
        email: user.email,
        username: user.username
      });

      const refreshToken = generateRefreshToken({
        id: user._id
      });

      // Return user data
      const userResponse = user.toJSON();
      
      return {
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          tokens: {
            accessToken,
            refreshToken,
            tokenType: 'Bearer'
          }
        }
      };
    } catch (error) {
      // Re-throw custom errors
      if (error.code === 'INVALID_CREDENTIALS' || error.code === 'ACCOUNT_DEACTIVATED') {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User data
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.isActive) {
        throw createError('User account is deactivated', 404, 'USER_DEACTIVATED');
      }

      return {
        success: true,
        data: user.toJSON()
      };
    } catch (error) {
      // Re-throw custom errors
      if (error.code === 'USER_NOT_FOUND' || error.code === 'USER_DEACTIVATED') {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Profile update data
   * @returns {Promise<Object>} Updated user data
   */
  async updateUserProfile(userId, updateData) {
    try {
      const { firstName, lastName, avatar } = updateData;
      
      // Validate update data
      const updates = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (avatar !== undefined) updates.avatar = avatar;

      // Update user
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      return {
        success: true,
        message: 'Profile updated successfully',
        data: user.toJSON()
      };
    } catch (error) {
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(e => e.message);
        throw createError(errors.join(', '), 400, 'VALIDATION_ERROR');
      }
      
      // Re-throw custom errors
      if (error.code === 'USER_NOT_FOUND') {
        throw error;
      }
      
      throw error;
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {Object} passwordData - Password change data
   * @param {string} passwordData.currentPassword - Current password
   * @param {string} passwordData.newPassword - New password
   * @returns {Promise<Object>} Success response
   */
  async changePassword(userId, passwordData) {
    const { currentPassword, newPassword } = passwordData;

    try {
      // Find user with password
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw createError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
      }

      // Check if new password is different
      const isNewPasswordSame = await user.comparePassword(newPassword);
      if (isNewPasswordSame) {
        throw createError('New password must be different from current password', 400, 'PASSWORD_SAME');
      }

      // Update password
      user.password = newPassword;
      await user.save();

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      // Re-throw custom errors
      if (error.code === 'USER_NOT_FOUND' || 
          error.code === 'INVALID_CURRENT_PASSWORD' || 
          error.code === 'PASSWORD_SAME') {
        throw error;
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        throw createError('Invalid password format', 400, 'VALIDATION_ERROR');
      }
      
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Success response
   */
  async deactivateAccount(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { isActive: false },
        { new: true }
      );

      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      return {
        success: true,
        message: 'Account deactivated successfully'
      };
    } catch (error) {
      // Re-throw custom errors
      if (error.code === 'USER_NOT_FOUND') {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get user statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats(userId) {
    try {
      // This would typically integrate with todo service
      // For now, returning basic user info
      const user = await User.findById(userId);
      
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      return {
        success: true,
        data: {
          userId: user._id,
          username: user.username,
          email: user.email,
          accountCreated: user.createdAt,
          lastLogin: user.lastLogin,
          isActive: user.isActive
        }
      };
    } catch (error) {
      // Re-throw custom errors
      if (error.code === 'USER_NOT_FOUND') {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Verify email address
   * @param {string} token - Email verification token
   * @returns {Promise<Object>} Verification result
   */
  async verifyEmail(token) {
    try {
      // This would integrate with JWT utils to verify token
      // For now, placeholder implementation
      throw createError('Email verification not implemented', 501, 'NOT_IMPLEMENTED');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh authentication tokens
   * @param {string} refreshToken - Refresh token
   * @param {string} userId - User ID
   * @returns {Promise<Object>} New tokens
   */
  async refreshTokens(refreshToken, userId) {
    try {
      // This would integrate with JWT utils to verify and refresh tokens
      // For now, placeholder implementation
      throw createError('Token refresh not implemented', 501, 'NOT_IMPLEMENTED');
    } catch (error) {
      throw error;
    }
  }
}

// Create singleton instance
const userService = new UserService();

// Export service methods
export const {
  register,
  login,
  getUserById,
  updateUserProfile,
  changePassword,
  deactivateAccount,
  getUserStats,
  verifyEmail,
  refreshTokens
} = userService;

// Export the class and instance
export { UserService };
export default userService;