# GraphQL Todo Codebase Documentation

## Overview

This project is a Node.js GraphQL API for user authentication and todo management.

- Runtime: Node.js (ES modules)
- Server: Express + Apollo Server (`apollo-server-express` v3)
- Database: MongoDB via Mongoose
- Auth: JWT access/refresh token flow

Primary entry point:

- `src/server.js`

## High-Level Architecture

Request flow:

1. Express app starts and connects to MongoDB (`src/config/database.js`).
2. Apollo Server mounts at `/graphql`.
3. GraphQL resolvers in `src/resolvers/index.js` call service-layer methods.
4. Services (`src/services/*`) encapsulate business logic and Mongoose operations.
5. Models (`src/models/*`) enforce schema rules, hooks, virtuals, and methods.

Main layers:

- **Schema Layer**: GraphQL type system (`src/schema/typeDefs.js`)
- **Resolver Layer**: GraphQL execution logic (`src/resolvers/index.js`)
- **Service Layer**: domain operations (`src/services/userService.js`, `src/services/todoService.js`)
- **Data Layer**: Mongoose models (`src/models/User.js`, `src/models/Todo.js`)
- **Cross-Cutting**: JWT utilities + middleware (`src/utils/jwt.js`, `src/middleware/*`)

## Server and Runtime

`src/server.js` configures:

- Environment loading via `dotenv`
- Global CORS policy (`ALLOWED_ORIGINS`, defaults to `http://localhost:3000`)
- JSON/urlencoded body parsers
- Health endpoint: `GET /health`
- Info page: `GET /`
- Apollo GraphQL endpoint: `/graphql`
- Graceful shutdown for `SIGINT` and `SIGTERM`

GraphQL settings:

- `introspection` and `playground` enabled outside production
- Production error masking for unclassified internal errors
- Plugin logs GraphQL resolver errors

## GraphQL Schema Surface

Defined in `src/schema/typeDefs.js`.

Core types:

- `User`, `Todo`
- Nested types: `Attachment`, `Reminder`, `Subtask`
- `AuthResponse`, `Tokens`, `ApiResponse`
- Metrics: `UserStats`, `TodoStats`, `PriorityDistribution`
- Pagination: `TodoList`, `Pagination`

Queries:

- `me`, `getUser`
- `getTodos`, `getTodo`
- `getUserStats`, `getTodoStats`
- `getOverdueTodos`, `getTodosDueToday`

Mutations:

- Auth/user: `register`, `login`, `updateUserProfile`, `changePassword`, `deactivateAccount`, `verifyEmail`, `refreshTokens`
- Todo: `createTodo`, `updateTodo`, `deleteTodo`, `toggleTodo`, `addSubtask`, `toggleSubtask`, `removeSubtask`

## Authentication and Authorization

Auth is token-based and enforced mainly in resolver helper `getAuthenticatedUser()`:

- Reads `Authorization: Bearer <token>`
- Verifies JWT (`verifyToken`)
- Requires token type `access`
- Loads current user via `userService.getUserById`

JWT utility (`src/utils/jwt.js`) provides:

- Access, refresh, email verification, password reset token generation
- Token verification/decoding
- Expiration/type helpers
- Stubbed token blacklist checks (currently always `false`)

## Data Models

### User model (`src/models/User.js`)

- Unique `username` and `email`
- Password hash in pre-save hook (`bcryptjs`, salt rounds 12)
- Password excluded by default (`select: false`)
- Profile fields: `firstName`, `lastName`, `avatar`
- Status fields: `isActive`, `emailVerified`, `lastLogin`
- Virtual and method for `fullName`
- `toJSON()` strips sensitive fields

### Todo model (`src/models/Todo.js`)

- Core fields: `title`, `description`, `completed`, `priority`, `dueDate`
- Organization fields: `tags`, `category`
- Relationships: `createdBy` (required), `assignedTo`
- Embedded arrays: `attachments`, `reminders`, `subtasks`
- Virtuals: `formattedDueDate`, `completionPercentage`, `isOverdue`, `daysUntilDue`
- Methods: toggle completion, add/remove/toggle subtasks
- Statics: overdue query, due-today query, aggregate stats, search

## Services

### User service (`src/services/userService.js`)

- Registration with duplicate checks + token generation
- Login with password validation and account status checks
- Profile update, password change, account deactivation, user stats
- `verifyEmail` and `refreshTokens` are currently placeholder methods throwing `NOT_IMPLEMENTED`

### Todo service (`src/services/todoService.js`)

- Create/read/update/delete todos with ownership checks
- Filtering/pagination/sorting in `getAllTodos`
- Toggle completion and add subtasks
- Todo statistics and date-based convenience queries

## Error Handling

`src/middleware/errorHandler.js` includes:

- Error classification helpers (validation, cast, duplicate key, JWT, etc.)
- Custom `createError(message, statusCode, code)` helper
- Global process-level handlers (unhandled rejection/exception, SIGTERM)

Note: these Express middlewares are defined but not mounted in `src/server.js` currently.

## Known Gaps and Inconsistencies

1. `package.json` scripts and `main` point to `server.js` in project root, but server implementation is in `src/server.js`.
2. GraphQL mutations `toggleSubtask` and `removeSubtask` return `NOT_IMPLEMENTED` in resolvers.
3. `userService.verifyEmail` and `userService.refreshTokens` are not implemented.
4. `auth.js` uses `blacklistToken(...)` in `logout()` without importing it.
5. Middleware modules (`auth.js`, `validation.js`, error middleware handlers) are mostly not wired into Express routing because API is GraphQL-first.
6. In database options, `serverSelectionTimeoutMS` is declared twice (last value wins).
7. `docs/README.md` currently contains placeholder content.

## Environment Variables

Expected runtime variables based on current code:

- `PORT` (default: `4000`)
- `NODE_ENV` (default: `development`)
- `ALLOWED_ORIGINS` (comma-separated list)
- `MONGODB_URI` (required for DB connection)
- `JWT_SECRET` (must be explicitly set in production)
- `JWT_EXPIRE` (default: `7d`)
- `JWT_REFRESH_EXPIRE` (default: `30d`)

## Suggested Next Steps

- Align start scripts with `src/server.js` or move server file to root.
- Implement remaining auth/subtask mutation paths.
- Decide whether to keep Express middleware modules; if yes, integrate or remove dead paths.
- Replace `docs/README.md` placeholder with links to this document and API usage examples.
