import { gql } from 'apollo-server-express';

/**
 * GraphQL Type Definitions
 * Defines the schema for the GraphQL API
 */

export const typeDefs = gql`
  """
  A user in the system
  """
  type User {
    id: ID!
    username: String!
    email: String!
    firstName: String
    lastName: String
    fullName: String
    avatar: String
    isActive: Boolean!
    emailVerified: Boolean!
    lastLogin: String
    createdAt: String!
    updatedAt: String!
  }

  """
  A todo item
  """
  type Todo {
    id: ID!
    title: String!
    description: String
    completed: Boolean!
    priority: Priority!
    dueDate: String
    formattedDueDate: String
    tags: [String!]!
    category: String
    isOverdue: Boolean
    daysUntilDue: Int
    completionPercentage: Int
    createdBy: User!
    assignedTo: User
    attachments: [Attachment!]!
    reminders: [Reminder!]!
    subtasks: [Subtask!]!
    createdAt: String!
    updatedAt: String!
  }

  """
  Attachment for a todo
  """
  type Attachment {
    url: String!
    name: String!
    type: AttachmentType!
  }

  """
  Reminder for a todo
  """
  type Reminder {
    date: String!
    sent: Boolean!
    message: String
  }

  """
  Subtask of a todo
  """
  type Subtask {
    id: ID!
    title: String!
    completed: Boolean!
    createdAt: String!
  }

  """
  Authentication response
  """
  type AuthResponse {
    user: User!
    tokens: Tokens!
    emailVerificationToken: String
  }

  """
  Authentication tokens
  """
  type Tokens {
    accessToken: String!
    refreshToken: String!
    tokenType: String!
  }

  """
  API response wrapper
  """
  type ApiResponse {
    success: Boolean!
    message: String
    data: ResponseData
    errors: [String!]
    code: String
  }

  """
  Response data union type
  """
  union ResponseData = User | Todo | TodoList | UserStats | TodoStats | AuthResponse

  """
  Paginated todo list
  """
  type TodoList {
    todos: [Todo!]!
    pagination: Pagination!
  }

  """
  Pagination information
  """
  type Pagination {
    currentPage: Int!
    totalPages: Int!
    totalItems: Int!
    itemsPerPage: Int!
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
  }

  """
  User statistics
  """
  type UserStats {
    userId: ID!
    username: String!
    email: String!
    accountCreated: String!
    lastLogin: String
    isActive: Boolean!
  }

  """
  Todo statistics
  """
  type TodoStats {
    total: Int!
    completed: Int!
    pending: Int!
    completionRate: Int!
    priorityDistribution: PriorityDistribution!
    withDueDates: Int!
    overdue: Int!
  }

  """
  Priority distribution statistics
  """
  type PriorityDistribution {
    high: Int!
    medium: Int!
    low: Int!
  }

  """
  Todo priority levels
  """
  enum Priority {
    low
    medium
    high
  }

  """
  Attachment types
  """
  enum AttachmentType {
    image
    document
    link
    other
  }

  """
  Input for creating a user
  """
  input UserInput {
    username: String!
    email: String!
    password: String!
    firstName: String
    lastName: String
  }

  """
  Input for user login
  """
  input LoginInput {
    email: String!
    password: String!
  }

  """
  Input for updating user profile
  """
  input UserProfileInput {
    firstName: String
    lastName: String
    avatar: String
  }

  """
  Input for changing password
  """
  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  """
  Input for creating a todo
  """
  input TodoInput {
    title: String!
    description: String
    priority: Priority
    dueDate: String
    tags: [String!]
    category: String
    assignedTo: ID
    attachments: [AttachmentInput!]
    reminders: [ReminderInput!]
  }

  """
  Input for updating a todo
  """
  input UpdateTodoInput {
    title: String
    description: String
    completed: Boolean
    priority: Priority
    dueDate: String
    tags: [String!]
    category: String
    assignedTo: ID
    attachments: [AttachmentInput!]
    reminders: [ReminderInput!]
  }

  """
  Input for attachment
  """
  input AttachmentInput {
    url: String!
    name: String!
    type: AttachmentType
  }

  """
  Input for reminder
  """
  input ReminderInput {
    date: String!
    message: String
  }

  """
  Input for adding subtask
  """
  input SubtaskInput {
    title: String!
  }

  """
  Input for filtering todos
  """
  input TodoFilterInput {
    completed: String
    priority: Priority
    search: String
    tags: [String!]
    category: String
    dueDateFrom: String
    dueDateTo: String
  }

  """
  Input for pagination
  """
  input PaginationInput {
    page: Int = 1
    limit: Int = 10
  }

  """
  Input for sorting
  """
  input SortInput {
    field: String = "createdAt"
    order: SortOrder = DESC
  }

  """
  Sort order enumeration
  """
  enum SortOrder {
    ASC
    DESC
  }

  """
  Root Query type
  """
  type Query {
    """
    Get current authenticated user
    """
    me: User
    
    """
    Get user by ID
    """
    getUser(id: ID!): User
    
    """
    Get all todos with filtering and pagination
    """
    getTodos(
      filters: TodoFilterInput
      pagination: PaginationInput
      sort: SortInput
    ): TodoList!
    
    """
    Get todo by ID
    """
    getTodo(id: ID!): Todo
    
    """
    Get user statistics
    """
    getUserStats: UserStats!
    
    """
    Get todo statistics
    """
    getTodoStats: TodoStats!
    
    """
    Get overdue todos
    """
    getOverdueTodos: TodoList!
    
    """
    Get todos due today
    """
    getTodosDueToday: TodoList!
  }

  """
  Root Mutation type
  """
  type Mutation {
    """
    Register a new user
    """
    register(input: UserInput!): AuthResponse!
    
    """
    Login user
    """
    login(input: LoginInput!): AuthResponse!
    
    """
    Update user profile
    """
    updateUserProfile(input: UserProfileInput!): User!
    
    """
    Change user password
    """
    changePassword(input: ChangePasswordInput!): ApiResponse!
    
    """
    Deactivate user account
    """
    deactivateAccount: ApiResponse!
    
    """
    Verify email address
    """
    verifyEmail(token: String!): ApiResponse!
    
    """
    Refresh authentication tokens
    """
    refreshTokens(refreshToken: String!): Tokens!
    
    """
    Create a new todo
    """
    createTodo(input: TodoInput!): Todo!
    
    """
    Update an existing todo
    """
    updateTodo(id: ID!, input: UpdateTodoInput!): Todo!
    
    """
    Delete a todo
    """
    deleteTodo(id: ID!): ApiResponse!
    
    """
    Toggle todo completion status
    """
    toggleTodo(id: ID!): Todo!
    
    """
    Add subtask to todo
    """
    addSubtask(todoId: ID!, input: SubtaskInput!): Todo!
    
    """
    Toggle subtask completion
    """
    toggleSubtask(todoId: ID!, subtaskId: ID!): Todo!
    
    """
    Remove subtask from todo
    """
    removeSubtask(todoId: ID!, subtaskId: ID!): Todo!
  }
`;