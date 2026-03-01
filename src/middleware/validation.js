/**
 * Validation Middleware
 * Provides comprehensive input validation for API endpoints
 */

class ValidationMiddleware {
  /**
   * Validate todo creation input
   * @returns {Function} Express middleware
   */
  validateTodoCreation() {
    return (req, res, next) => {
      const { title, description, priority, dueDate, tags, category } = req.body;
      const errors = [];

      // Title validation
      if (!title) {
        errors.push('Title is required');
      } else if (typeof title !== 'string') {
        errors.push('Title must be a string');
      } else if (title.trim().length === 0) {
        errors.push('Title cannot be empty');
      } else if (title.length > 100) {
        errors.push('Title cannot exceed 100 characters');
      }

      // Description validation
      if (description !== undefined) {
        if (typeof description !== 'string') {
          errors.push('Description must be a string');
        } else if (description.length > 500) {
          errors.push('Description cannot exceed 500 characters');
        }
      }

      // Priority validation
      if (priority !== undefined) {
        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(priority)) {
          errors.push('Priority must be low, medium, or high');
        }
      }

      // Due date validation
      if (dueDate !== undefined) {
        if (dueDate === null) {
          // Allow removing due date
        } else {
          const date = new Date(dueDate);
          if (isNaN(date.getTime())) {
            errors.push('Invalid due date format');
          } else if (date < new Date().setHours(0, 0, 0, 0)) {
            errors.push('Due date must be today or in the future');
          }
        }
      }

      // Tags validation
      if (tags !== undefined) {
        if (!Array.isArray(tags)) {
          errors.push('Tags must be an array');
        } else {
          const invalidTags = tags.filter(tag => {
            if (typeof tag !== 'string') return true;
            if (tag.trim().length === 0) return true;
            if (tag.length > 20) return true;
            return false;
          });
          
          if (invalidTags.length > 0) {
            errors.push('Each tag must be a non-empty string with max 20 characters');
          }
          
          // Check for duplicate tags
          const uniqueTags = [...new Set(tags.map(tag => tag.toLowerCase().trim()))];
          if (uniqueTags.length !== tags.length) {
            errors.push('Tags must be unique');
          }
        }
      }

      // Category validation
      if (category !== undefined) {
        if (typeof category !== 'string') {
          errors.push('Category must be a string');
        } else if (category.length > 30) {
          errors.push('Category cannot exceed 30 characters');
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        });
      }

      next();
    };
  }

  /**
   * Validate todo update input
   * @returns {Function} Express middleware
   */
  validateTodoUpdate() {
    return (req, res, next) => {
      const { title, description, priority, dueDate, tags, category, completed } = req.body;
      const errors = [];

      // Title validation (optional)
      if (title !== undefined) {
        if (typeof title !== 'string') {
          errors.push('Title must be a string');
        } else if (title.length > 100) {
          errors.push('Title cannot exceed 100 characters');
        } else if (title.trim().length === 0) {
          errors.push('Title cannot be empty');
        }
      }

      // Description validation (optional)
      if (description !== undefined) {
        if (typeof description !== 'string') {
          errors.push('Description must be a string');
        } else if (description.length > 500) {
          errors.push('Description cannot exceed 500 characters');
        }
      }

      // Priority validation (optional)
      if (priority !== undefined) {
        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(priority)) {
          errors.push('Priority must be low, medium, or high');
        }
      }

      // Completed validation (optional)
      if (completed !== undefined && typeof completed !== 'boolean') {
        errors.push('Completed must be a boolean');
      }

      // Due date validation (optional)
      if (dueDate !== undefined) {
        if (dueDate === null) {
          // Allow removing due date
        } else {
          const date = new Date(dueDate);
          if (isNaN(date.getTime())) {
            errors.push('Invalid due date format');
          } else if (date < new Date().setHours(0, 0, 0, 0)) {
            errors.push('Due date must be today or in the future');
          }
        }
      }

      // Tags validation (optional)
      if (tags !== undefined) {
        if (!Array.isArray(tags)) {
          errors.push('Tags must be an array');
        } else {
          const invalidTags = tags.filter(tag => {
            if (typeof tag !== 'string') return true;
            if (tag.trim().length === 0) return true;
            if (tag.length > 20) return true;
            return false;
          });
          
          if (invalidTags.length > 0) {
            errors.push('Each tag must be a non-empty string with max 20 characters');
          }
          
          // Check for duplicate tags
          const uniqueTags = [...new Set(tags.map(tag => tag.toLowerCase().trim()))];
          if (uniqueTags.length !== tags.length) {
            errors.push('Tags must be unique');
          }
        }
      }

      // Category validation (optional)
      if (category !== undefined) {
        if (typeof category !== 'string') {
          errors.push('Category must be a string');
        } else if (category.length > 30) {
          errors.push('Category cannot exceed 30 characters');
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        });
      }

      next();
    };
  }

  /**
   * Validate user registration input
   * @returns {Function} Express middleware
   */
  validateUserRegistration() {
    return (req, res, next) => {
      const { username, email, password, firstName, lastName } = req.body;
      const errors = [];

      // Username validation
      if (!username) {
        errors.push('Username is required');
      } else if (typeof username !== 'string') {
        errors.push('Username must be a string');
      } else if (username.length < 3) {
        errors.push('Username must be at least 3 characters');
      } else if (username.length > 30) {
        errors.push('Username cannot exceed 30 characters');
      } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errors.push('Username can only contain letters, numbers, and underscores');
      }

      // Email validation
      if (!email) {
        errors.push('Email is required');
      } else if (typeof email !== 'string') {
        errors.push('Email must be a string');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Please enter a valid email address');
      }

      // Password validation
      if (!password) {
        errors.push('Password is required');
      } else if (typeof password !== 'string') {
        errors.push('Password must be a string');
      } else if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
      } else if (password.length > 128) {
        errors.push('Password cannot exceed 128 characters');
      } else {
        // Check for common weak passwords
        const weakPasswords = ['password', '12345678', 'qwertyui', 'admin123'];
        if (weakPasswords.includes(password.toLowerCase())) {
          errors.push('Password is too weak. Please choose a stronger password.');
        }
      }

      // First name validation (optional)
      if (firstName !== undefined) {
        if (typeof firstName !== 'string') {
          errors.push('First name must be a string');
        } else if (firstName.length > 50) {
          errors.push('First name cannot exceed 50 characters');
        }
      }

      // Last name validation (optional)
      if (lastName !== undefined) {
        if (typeof lastName !== 'string') {
          errors.push('Last name must be a string');
        } else if (lastName.length > 50) {
          errors.push('Last name cannot exceed 50 characters');
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        });
      }

      next();
    };
  }

  /**
   * Validate user login input
   * @returns {Function} Express middleware
   */
  validateUserLogin() {
    return (req, res, next) => {
      const { email, password } = req.body;
      const errors = [];

      // Email validation
      if (!email) {
        errors.push('Email is required');
      } else if (typeof email !== 'string') {
        errors.push('Email must be a string');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Please enter a valid email address');
      }

      // Password validation
      if (!password) {
        errors.push('Password is required');
      } else if (typeof password !== 'string') {
        errors.push('Password must be a string');
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        });
      }

      next();
    };
  }

  /**
   * Validate ID parameters
   * @returns {Function} Express middleware
   */
  validateIdParam(paramName = 'id') {
    return (req, res, next) => {
      const id = req.params[paramName] || req.body[paramName];
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: `${paramName} is required`,
          code: 'MISSING_ID'
        });
      }

      if (typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: `${paramName} must be a string`,
          code: 'INVALID_ID_TYPE'
        });
      }

      // Basic MongoDB ObjectId validation
      if (id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${paramName} format`,
          code: 'INVALID_ID_FORMAT'
        });
      }

      next();
    };
  }

  /**
   * Validate query parameters for todo listing
   * @returns {Function} Express middleware
   */
  validateTodoQuery() {
    return (req, res, next) => {
      const { completed, priority, search, tags, category, page, limit } = req.query;
      const errors = [];

      // Completed validation
      if (completed !== undefined) {
        if (completed !== 'true' && completed !== 'false') {
          errors.push('Completed must be true or false');
        }
      }

      // Priority validation
      if (priority !== undefined) {
        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(priority)) {
          errors.push('Priority must be low, medium, or high');
        }
      }

      // Search validation
      if (search !== undefined) {
        if (typeof search !== 'string') {
          errors.push('Search must be a string');
        } else if (search.length > 100) {
          errors.push('Search term cannot exceed 100 characters');
        }
      }

      // Tags validation
      if (tags !== undefined) {
        const tagArray = Array.isArray(tags) ? tags : tags.split(',');
        const invalidTags = tagArray.filter(tag => {
          if (typeof tag !== 'string') return true;
          if (tag.trim().length === 0) return true;
          if (tag.length > 20) return true;
          return false;
        });
        
        if (invalidTags.length > 0) {
          errors.push('Each tag must be a non-empty string with max 20 characters');
        }
      }

      // Category validation
      if (category !== undefined) {
        if (typeof category !== 'string') {
          errors.push('Category must be a string');
        } else if (category.length > 30) {
          errors.push('Category cannot exceed 30 characters');
        }
      }

      // Pagination validation
      if (page !== undefined) {
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
          errors.push('Page must be a positive integer');
        }
      }

      if (limit !== undefined) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          errors.push('Limit must be between 1 and 100');
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        });
      }

      next();
    };
  }

  /**
   * Generic validation helper
   * @param {Function} validator - Custom validation function
   * @returns {Function} Express middleware
   */
  validate(validator) {
    return (req, res, next) => {
      try {
        const result = validator(req);
        if (result !== true) {
          const errors = Array.isArray(result) ? result : [result];
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors,
            code: 'VALIDATION_ERROR'
          });
        }
        next();
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: [error.message],
          code: 'VALIDATION_ERROR'
        });
      }
    };
  }
}

// Create singleton instance
const validationMiddleware = new ValidationMiddleware();

// Export validation methods
export const {
  validateTodoCreation,
  validateTodoUpdate,
  validateUserRegistration,
  validateUserLogin,
  validateIdParam,
  validateTodoQuery,
  validate
} = validationMiddleware;

// Export the class and instance
export { ValidationMiddleware };
export default validationMiddleware;