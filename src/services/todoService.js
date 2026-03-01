import Todo from '../models/Todo.js';
import User from '../models/User.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * Todo Service
 * Handles all todo-related business logic and operations
 */

class TodoService {
  /**
   * Create a new todo
   * @param {Object} todoData - Todo creation data
   * @param {string} userId - User ID of creator
   * @returns {Promise<Object>} Created todo
   */
  async createTodo(todoData, userId) {
    const { title, description, priority, dueDate, tags, category, assignedTo } = todoData;

    try {
      // Verify user exists and is active
      const user = await User.findById(userId);
      if (!user || !user.isActive) {
        throw createError('User not found or inactive', 404, 'USER_NOT_FOUND');
      }

      // Verify assigned user exists (if provided)
      if (assignedTo) {
        const assignedUser = await User.findById(assignedTo);
        if (!assignedUser || !assignedUser.isActive) {
          throw createError('Assigned user not found or inactive', 400, 'ASSIGNED_USER_INVALID');
        }
      }

      // Create todo
      const todo = new Todo({
        title,
        description,
        priority: priority || 'medium',
        dueDate,
        tags: tags || [],
        category,
        createdBy: userId,
        assignedTo
      });

      await todo.save();

      // Populate referenced fields for response
      await todo.populate([
        { path: 'createdBy', select: 'username email firstName lastName' },
        { path: 'assignedTo', select: 'username email firstName lastName' }
      ]);

      return {
        success: true,
        message: 'Todo created successfully',
        data: todo.toJSON()
      };
    } catch (error) {
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(e => e.message);
        throw createError(errors.join(', '), 400, 'VALIDATION_ERROR');
      }
      
      // Re-throw custom errors
      if (error.code === 'USER_NOT_FOUND' || error.code === 'ASSIGNED_USER_INVALID') {
        throw error;
      }
      
      throw error;
    }
  }

  /**
   * Get all todos for a user with filtering and pagination
   * @param {string} userId - User ID
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Todos list with metadata
   */
  async getAllTodos(userId, filters = {}, pagination = {}) {
    try {
      const { 
        completed, 
        priority, 
        search, 
        tags, 
        category, 
        dueDateFrom, 
        dueDateTo,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const { page = 1, limit = 10 } = pagination;

      // Build query
      const query = { createdBy: userId };

      // Apply filters
      if (completed !== undefined) {
        query.completed = completed === 'true' || completed === true;
      }

      if (priority) {
        query.priority = priority;
      }

      if (category) {
        query.category = category;
      }

      // Text search
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Tag filtering
      if (tags && tags.length > 0) {
        query.tags = { $all: Array.isArray(tags) ? tags : [tags] };
      }

      // Date range filtering
      if (dueDateFrom || dueDateTo) {
        query.dueDate = {};
        if (dueDateFrom) query.dueDate.$gte = new Date(dueDateFrom);
        if (dueDateTo) query.dueDate.$lte = new Date(dueDateTo);
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [todos, total] = await Promise.all([
        Todo.find(query)
          .populate([
            { path: 'createdBy', select: 'username email firstName lastName' },
            { path: 'assignedTo', select: 'username email firstName lastName' }
          ])
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit)),
        Todo.countDocuments(query)
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        success: true,
        data: {
          todos: todos.map(todo => todo.toJSON()),
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: total,
            itemsPerPage: parseInt(limit),
            hasNextPage,
            hasPrevPage
          }
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get todo by ID
   * @param {string} todoId - Todo ID
   * @param {string} userId - User ID (for ownership verification)
   * @returns {Promise<Object>} Todo data
   */
  async getTodoById(todoId, userId) {
    try {
      const todo = await Todo.findById(todoId)
        .populate([
          { path: 'createdBy', select: 'username email firstName lastName' },
          { path: 'assignedTo', select: 'username email firstName lastName' }
        ]);

      if (!todo) {
        throw createError('Todo not found', 404, 'TODO_NOT_FOUND');
      }

      // Verify ownership
      if (todo.createdBy._id.toString() !== userId) {
        throw createError('Access denied. You do not own this todo.', 403, 'ACCESS_DENIED');
      }

      return {
        success: true,
        data: todo.toJSON()
      };
    } catch (error) {
      // Re-throw custom errors
      if (error.code === 'TODO_NOT_FOUND' || error.code === 'ACCESS_DENIED') {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Update todo
   * @param {string} todoId - Todo ID
   * @param {Object} updateData - Update data
   * @param {string} userId - User ID (for ownership verification)
   * @returns {Promise<Object>} Updated todo
   */
  async updateTodo(todoId, updateData, userId) {
    try {
      // Verify todo exists and user owns it
      const existingTodo = await Todo.findById(todoId);
      if (!existingTodo) {
        throw createError('Todo not found', 404, 'TODO_NOT_FOUND');
      }

      if (existingTodo.createdBy.toString() !== userId) {
        throw createError('Access denied. You do not own this todo.', 403, 'ACCESS_DENIED');
      }

      // Handle assignedTo validation
      if (updateData.assignedTo) {
        const assignedUser = await User.findById(updateData.assignedTo);
        if (!assignedUser || !assignedUser.isActive) {
          throw createError('Assigned user not found or inactive', 400, 'ASSIGNED_USER_INVALID');
        }
      }

      // Update todo
      const updatedTodo = await Todo.findByIdAndUpdate(
        todoId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate([
        { path: 'createdBy', select: 'username email firstName lastName' },
        { path: 'assignedTo', select: 'username email firstName lastName' }
      ]);

      return {
        success: true,
        message: 'Todo updated successfully',
        data: updatedTodo.toJSON()
      };
    } catch (error) {
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(e => e.message);
        throw createError(errors.join(', '), 400, 'VALIDATION_ERROR');
      }
      
      // Re-throw custom errors
      if (error.code === 'TODO_NOT_FOUND' || 
          error.code === 'ACCESS_DENIED' || 
          error.code === 'ASSIGNED_USER_INVALID') {
        throw error;
      }
      
      throw error;
    }
  }

  /**
   * Delete todo
   * @param {string} todoId - Todo ID
   * @param {string} userId - User ID (for ownership verification)
   * @returns {Promise<Object>} Success response
   */
  async deleteTodo(todoId, userId) {
    try {
      // Verify todo exists and user owns it
      const todo = await Todo.findById(todoId);
      if (!todo) {
        throw createError('Todo not found', 404, 'TODO_NOT_FOUND');
      }

      if (todo.createdBy.toString() !== userId) {
        throw createError('Access denied. You do not own this todo.', 403, 'ACCESS_DENIED');
      }

      // Delete todo
      await Todo.findByIdAndDelete(todoId);

      return {
        success: true,
        message: 'Todo deleted successfully'
      };
    } catch (error) {
      // Re-throw custom errors
      if (error.code === 'TODO_NOT_FOUND' || error.code === 'ACCESS_DENIED') {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Toggle todo completion status
   * @param {string} todoId - Todo ID
   * @param {string} userId - User ID (for ownership verification)
   * @returns {Promise<Object>} Updated todo
   */
  async toggleTodoCompletion(todoId, userId) {
    try {
      const todo = await Todo.findById(todoId);
      if (!todo) {
        throw createError('Todo not found', 404, 'TODO_NOT_FOUND');
      }

      if (todo.createdBy.toString() !== userId) {
        throw createError('Access denied. You do not own this todo.', 403, 'ACCESS_DENIED');
      }

      // Toggle completion and update subtasks if completed
      todo.completed = !todo.completed;
      if (todo.completed) {
        todo.subtasks.forEach(subtask => {
          subtask.completed = true;
        });
      }
      
      await todo.save();

      // Populate for response
      await todo.populate([
        { path: 'createdBy', select: 'username email firstName lastName' },
        { path: 'assignedTo', select: 'username email firstName lastName' }
      ]);

      return {
        success: true,
        message: `Todo marked as ${todo.completed ? 'completed' : 'pending'}`,
        data: todo.toJSON()
      };
    } catch (error) {
      // Re-throw custom errors
      if (error.code === 'TODO_NOT_FOUND' || error.code === 'ACCESS_DENIED') {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Add subtask to todo
   * @param {string} todoId - Todo ID
   * @param {Object} subtaskData - Subtask data
   * @param {string} userId - User ID (for ownership verification)
   * @returns {Promise<Object>} Updated todo
   */
  async addSubtask(todoId, subtaskData, userId) {
    try {
      const { title } = subtaskData;
      
      if (!title || title.trim().length === 0) {
        throw createError('Subtask title is required', 400, 'INVALID_SUBTASK_TITLE');
      }

      const todo = await Todo.findById(todoId);
      if (!todo) {
        throw createError('Todo not found', 404, 'TODO_NOT_FOUND');
      }

      if (todo.createdBy.toString() !== userId) {
        throw createError('Access denied. You do not own this todo.', 403, 'ACCESS_DENIED');
      }

      // Add subtask
      todo.subtasks.push({
        title: title.trim(),
        completed: false,
        createdAt: new Date()
      });

      await todo.save();

      // Populate for response
      await todo.populate([
        { path: 'createdBy', select: 'username email firstName lastName' },
        { path: 'assignedTo', select: 'username email firstName lastName' }
      ]);

      return {
        success: true,
        message: 'Subtask added successfully',
        data: todo.toJSON()
      };
    } catch (error) {
      // Re-throw custom errors
      if (error.code === 'TODO_NOT_FOUND' || 
          error.code === 'ACCESS_DENIED' || 
          error.code === 'INVALID_SUBTASK_TITLE') {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get todo statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Todo statistics
   */
  async getTodoStats(userId) {
    try {
      const stats = await Todo.getStats(userId);
      
      // Calculate additional metrics
      const completionRate = stats.total > 0 
        ? Math.round((stats.completed / stats.total) * 100) 
        : 0;

      return {
        success: true,
        data: {
          total: stats.total,
          completed: stats.completed,
          pending: stats.pending,
          completionRate,
          priorityDistribution: {
            high: stats.highPriority,
            medium: stats.mediumPriority,
            low: stats.lowPriority
          },
          withDueDates: stats.withDueDate,
          overdue: stats.overdue
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get overdue todos
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Overdue todos
   */
  async getOverdueTodos(userId) {
    try {
      const overdueTodos = await Todo.findOverdue(userId)
        .populate([
          { path: 'createdBy', select: 'username email firstName lastName' },
          { path: 'assignedTo', select: 'username email firstName lastName' }
        ]);

      return {
        success: true,
        data: {
          count: overdueTodos.length,
          todos: overdueTodos.map(todo => todo.toJSON())
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get todos due today
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Todos due today
   */
  async getTodosDueToday(userId) {
    try {
      const dueTodayTodos = await Todo.findDueToday(userId)
        .populate([
          { path: 'createdBy', select: 'username email firstName lastName' },
          { path: 'assignedTo', select: 'username email firstName lastName' }
        ]);

      return {
        success: true,
        data: {
          count: dueTodayTodos.length,
          todos: dueTodayTodos.map(todo => todo.toJSON())
        }
      };
    } catch (error) {
      throw error;
    }
  }
}

// Create singleton instance
const todoService = new TodoService();

// Export service methods
export const {
  createTodo,
  getAllTodos,
  getTodoById,
  updateTodo,
  deleteTodo,
  toggleTodoCompletion,
  addSubtask,
  getTodoStats,
  getOverdueTodos,
  getTodosDueToday
} = todoService;

// Export the class and instance
export { TodoService };
export default todoService;