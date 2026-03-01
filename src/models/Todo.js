import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  completed: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high'],
      message: 'Priority must be low, medium, or high'
    },
    default: 'medium'
  },
  dueDate: {
    type: Date,
    validate: {
      validator: function(date) {
        // Allow null/undefined dates, but if provided, must be future date
        return !date || date >= new Date();
      },
      message: 'Due date must be today or in the future'
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [20, 'Tag cannot exceed 20 characters'],
    validate: {
      validator: function(tag) {
        return tag && tag.length > 0;
      },
      message: 'Tag cannot be empty'
    }
  }],
  category: {
    type: String,
    trim: true,
    maxlength: [30, 'Category cannot exceed 30 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  attachments: [{
    url: {
      type: String,
      required: true,
      validate: {
        validator: function(url) {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid attachment URL'
      }
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['image', 'document', 'link', 'other'],
      default: 'other'
    }
  }],
  reminders: [{
    date: {
      type: Date,
      required: true
    },
    sent: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      maxlength: [200, 'Reminder message cannot exceed 200 characters']
    }
  }],
  subtasks: [{
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, 'Subtask title cannot exceed 50 characters']
    },
    completed: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
todoSchema.index({ createdBy: 1, completed: 1 });
todoSchema.index({ createdBy: 1, priority: 1 });
todoSchema.index({ dueDate: 1 });
todoSchema.index({ tags: 1 });
todoSchema.index({ category: 1 });
todoSchema.index({ assignedTo: 1 });
todoSchema.index({ createdAt: -1 });
todoSchema.index({ title: 'text', description: 'text' });

// Virtual for formatted due date
todoSchema.virtual('formattedDueDate').get(function() {
  return this.dueDate ? this.dueDate.toISOString().split('T')[0] : null;
});

// Virtual for completion percentage (for subtasks)
todoSchema.virtual('completionPercentage').get(function() {
  if (this.subtasks.length === 0) return 0;
  const completedCount = this.subtasks.filter(subtask => subtask.completed).length;
  return Math.round((completedCount / this.subtasks.length) * 100);
});

// Virtual for overdue status
todoSchema.virtual('isOverdue').get(function() {
  return this.dueDate && !this.completed && this.dueDate < new Date();
});

// Virtual for days until due
todoSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  const today = new Date();
  const dueDate = new Date(this.dueDate);
  const diffTime = dueDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to validate subtasks
todoSchema.pre('save', function(next) {
  // Ensure subtask titles are not empty
  if (this.subtasks) {
    this.subtasks = this.subtasks.filter(subtask => 
      subtask.title && subtask.title.trim().length > 0
    );
  }
  
  // Ensure tags are unique and not empty
  if (this.tags) {
    this.tags = [...new Set(this.tags.filter(tag => tag && tag.trim().length > 0))];
  }
  
  next();
});

// Pre-update middleware
todoSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Clean up subtasks if being updated
  if (update.$set && update.$set.subtasks) {
    update.$set.subtasks = update.$set.subtasks.filter(subtask => 
      subtask.title && subtask.title.trim().length > 0
    );
  }
  
  // Clean up tags if being updated
  if (update.$set && update.$set.tags) {
    update.$set.tags = [...new Set(update.$set.tags.filter(tag => tag && tag.trim().length > 0))];
  }
  
  next();
});

// Instance method to toggle completion status
todoSchema.methods.toggleCompletion = function() {
  this.completed = !this.completed;
  if (this.completed) {
    // Mark all subtasks as completed when main todo is completed
    this.subtasks.forEach(subtask => {
      subtask.completed = true;
    });
  }
  return this.save();
};

// Instance method to add a subtask
todoSchema.methods.addSubtask = function(title) {
  if (!title || title.trim().length === 0) {
    throw new Error('Subtask title is required');
  }
  
  if (title.length > 50) {
    throw new Error('Subtask title cannot exceed 50 characters');
  }
  
  this.subtasks.push({
    title: title.trim(),
    completed: false,
    createdAt: new Date()
  });
  
  return this.save();
};

// Instance method to remove a subtask
todoSchema.methods.removeSubtask = function(subtaskId) {
  this.subtasks = this.subtasks.filter(
    subtask => subtask._id.toString() !== subtaskId.toString()
  );
  return this.save();
};

// Instance method to toggle subtask completion
todoSchema.methods.toggleSubtask = function(subtaskId) {
  const subtask = this.subtasks.find(
    s => s._id.toString() === subtaskId.toString()
  );
  
  if (subtask) {
    subtask.completed = !subtask.completed;
    return this.save();
  }
  
  throw new Error('Subtask not found');
};

// Static method to find overdue todos
todoSchema.statics.findOverdue = function(userId) {
  return this.find({
    createdBy: userId,
    completed: false,
    dueDate: { $lt: new Date() }
  });
};

// Static method to find todos due today
todoSchema.statics.findDueToday = function(userId) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.find({
    createdBy: userId,
    completed: false,
    dueDate: {
      $gte: today,
      $lt: tomorrow
    }
  });
};

// Static method to get todo statistics
todoSchema.statics.getStats = async function(userId) {
  const pipeline = [
    { $match: { createdBy: userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$completed', true] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$completed', false] }, 1, 0] } },
        highPriority: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
        mediumPriority: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
        lowPriority: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } },
        withDueDate: { $sum: { $cond: [{ $ne: ['$dueDate', null] }, 1, 0] } },
        overdue: { 
          $sum: { 
            $cond: [
              { 
                $and: [
                  { $eq: ['$completed', false] },
                  { $lt: ['$dueDate', new Date()] }
                ]
              }, 
              1, 
              0
            ] 
          } 
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result.length > 0 ? result[0] : {
    total: 0,
    completed: 0,
    pending: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0,
    withDueDate: 0,
    overdue: 0
  };
};

// Static method to search todos
todoSchema.statics.search = function(userId, searchTerm, filters = {}) {
  const query = { createdBy: userId };
  
  // Add text search if searchTerm provided
  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }
  
  // Apply additional filters
  if (filters.completed !== undefined) {
    query.completed = filters.completed;
  }
  
  if (filters.priority) {
    query.priority = filters.priority;
  }
  
  if (filters.category) {
    query.category = filters.category;
  }
  
  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $all: filters.tags };
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// Ensure virtual fields are serialized
todoSchema.set('toJSON', { virtuals: true });
todoSchema.set('toObject', { virtuals: true });

export default mongoose.model('Todo', todoSchema);