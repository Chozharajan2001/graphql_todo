import userService from '../services/userService.js';
import todoService from '../services/todoService.js';
import { verifyToken, extractUserId } from '../utils/jwt.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * GraphQL Resolvers
 * Handles GraphQL query and mutation execution
 */

// Helper function to get authenticated user
const getAuthenticatedUser = async (context) => {
  if (!context || !context.req) {
    throw createError('Request context required', 400, 'CONTEXT_REQUIRED');
  }

  const token = context.req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  try {
    const decoded = verifyToken(token);
    if (decoded.type !== 'access') {
      throw createError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
    }
    
    const userResult = await userService.getUserById(decoded.id);
    return userResult.data;
  } catch (error) {
    throw createError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
};

// Query resolvers
const Query = {
  // Get current authenticated user
  me: async (parent, args, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      return user;
    } catch (error) {
      throw error;
    }
  },

  // Get user by ID
  getUser: async (parent, { id }, context) => {
    try {
      // Only allow users to get their own info or admins
      const currentUser = await getAuthenticatedUser(context);
      if (currentUser.id !== id) {
        throw createError('Access denied', 403, 'ACCESS_DENIED');
      }
      
      const result = await userService.getUserById(id);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all todos with filtering and pagination
  getTodos: async (parent, { filters, pagination, sort }, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.getAllTodos(
        user.id,
        filters || {},
        pagination || {},
        sort || {}
      );
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Get todo by ID
  getTodo: async (parent, { id }, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.getTodoById(id, user.id);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user statistics
  getUserStats: async (parent, args, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await userService.getUserStats(user.id);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Get todo statistics
  getTodoStats: async (parent, args, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.getTodoStats(user.id);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Get overdue todos
  getOverdueTodos: async (parent, args, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.getOverdueTodos(user.id);
      
      // Format for pagination structure
      return {
        todos: result.data.todos,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: result.data.count,
          itemsPerPage: result.data.count,
          hasNextPage: false,
          hasPrevPage: false
        }
      };
    } catch (error) {
      throw error;
    }
  },

  // Get todos due today
  getTodosDueToday: async (parent, args, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.getTodosDueToday(user.id);
      
      // Format for pagination structure
      return {
        todos: result.data.todos,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: result.data.count,
          itemsPerPage: result.data.count,
          hasNextPage: false,
          hasPrevPage: false
        }
      };
    } catch (error) {
      throw error;
    }
  }
};

// Mutation resolvers
const Mutation = {
  // Register new user
  register: async (parent, { input }) => {
    try {
      const result = await userService.register(input);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // User login
  login: async (parent, { input }) => {
    try {
      const result = await userService.login(input);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Update user profile
  updateUserProfile: async (parent, { input }, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await userService.updateUserProfile(user.id, input);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Change user password
  changePassword: async (parent, { input }, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await userService.changePassword(user.id, input);
      return {
        success: result.success,
        message: result.message,
        code: 'PASSWORD_CHANGED'
      };
    } catch (error) {
      throw error;
    }
  },

  // Deactivate user account
  deactivateAccount: async (parent, args, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await userService.deactivateAccount(user.id);
      return {
        success: result.success,
        message: result.message,
        code: 'ACCOUNT_DEACTIVATED'
      };
    } catch (error) {
      throw error;
    }
  },

  // Verify email address
  verifyEmail: async (parent, { token }) => {
    try {
      const result = await userService.verifyEmail(token);
      return {
        success: result.success,
        message: result.message,
        code: 'EMAIL_VERIFIED'
      };
    } catch (error) {
      throw error;
    }
  },

  // Refresh authentication tokens
  refreshTokens: async (parent, { refreshToken }) => {
    try {
      // Extract user ID from refresh token
      const decoded = verifyToken(refreshToken);
      if (decoded.type !== 'refresh') {
        throw createError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }
      
      const result = await userService.refreshTokens(refreshToken, decoded.id);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new todo
  createTodo: async (parent, { input }, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.createTodo(input, user.id);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Update existing todo
  updateTodo: async (parent, { id, input }, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.updateTodo(id, input, user.id);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete todo
  deleteTodo: async (parent, { id }, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.deleteTodo(id, user.id);
      return {
        success: result.success,
        message: result.message,
        code: 'TODO_DELETED'
      };
    } catch (error) {
      throw error;
    }
  },

  // Toggle todo completion status
  toggleTodo: async (parent, { id }, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.toggleTodoCompletion(id, user.id);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Add subtask to todo
  addSubtask: async (parent, { todoId, input }, context) => {
    try {
      const user = await getAuthenticatedUser(context);
      const result = await todoService.addSubtask(todoId, input, user.id);
      return result.data;
    } catch (error) {
      throw error;
    }
  },

  // Toggle subtask completion
  toggleSubtask: async (parent, { todoId, subtaskId }, context) => {
    try {
      // This would need to be implemented in todoService
      throw createError('Subtask toggle not implemented', 501, 'NOT_IMPLEMENTED');
    } catch (error) {
      throw error;
    }
  },

  // Remove subtask from todo
  removeSubtask: async (parent, { todoId, subtaskId }, context) => {
    try {
      // This would need to be implemented in todoService
      throw createError('Subtask removal not implemented', 501, 'NOT_IMPLEMENTED');
    } catch (error) {
      throw error;
    }
  }
};

// Field resolvers for complex types
const Todo = {
  // Resolve createdBy relationship
  createdBy: async (parent) => {
    // Already populated in service layer
    return parent.createdBy;
  },

  // Resolve assignedTo relationship
  assignedTo: async (parent) => {
    // Already populated in service layer
    return parent.assignedTo || null;
  },

  // Format due date
  formattedDueDate: (parent) => {
    return parent.formattedDueDate || null;
  },

  // Check if overdue
  isOverdue: (parent) => {
    return parent.isOverdue || false;
  },

  // Days until due
  daysUntilDue: (parent) => {
    return parent.daysUntilDue !== undefined ? parent.daysUntilDue : null;
  },

  // Completion percentage
  completionPercentage: (parent) => {
    return parent.completionPercentage || 0;
  }
};

// Export resolvers
export const resolvers = {
  Query,
  Mutation,
  Todo
};

export default resolvers;