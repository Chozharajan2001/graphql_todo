# GraphQL Todo API - Project Overview

## What This Project Is

This is a GraphQL-first backend API for todo management with JWT-based authentication.
It is built with Node.js, Express, Apollo Server, and MongoDB (Mongoose).

The API supports:

- User registration and login
- Access/refresh token generation
- Authenticated todo CRUD
- Filtering, pagination, and sorting for todos
- Todo statistics and due-date based queries
- Subtask creation (partial subtask flow implemented)

## Tech Stack

- Node.js (ESM modules)
- Express `5.x`
- Apollo Server (`apollo-server-express` v3)
- MongoDB + Mongoose
- JWT (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- CORS + dotenv

## Project Structure

```text
src/
  config/
    database.js         # Mongo connection + status helpers
  middleware/
    auth.js             # Auth middleware utilities (mostly unused by GraphQL path)
    errorHandler.js     # Error helpers + global handlers
    validation.js       # Validation middleware utilities (mostly unused by GraphQL path)
  models/
    User.js             # User schema, hooks, methods
    Todo.js             # Todo schema, virtuals, methods, statics
  resolvers/
    index.js            # GraphQL query/mutation resolvers
  schema/
    typeDefs.js         # GraphQL type definitions
  services/
    userService.js      # User business logic
    todoService.js      # Todo business logic
  utils/
    jwt.js              # JWT generation/verification helpers
  server.js             # App bootstrap + Apollo/Express integration

docs/
  README.md             # This overview
  CODEBASE.md           # Detailed architecture and notes
```

## Runtime Endpoints

- `GET /` - HTML info page
- `GET /health` - health + DB status
- `POST /graphql` - GraphQL endpoint
- `GET /graphql` - GraphQL Playground (non-production)

## GraphQL Surface

### Main Queries

- `me`, `getUser`
- `getTodos`, `getTodo`
- `getUserStats`, `getTodoStats`
- `getOverdueTodos`, `getTodosDueToday`

### Main Mutations

- Auth/user: `register`, `login`, `updateUserProfile`, `changePassword`, `deactivateAccount`, `verifyEmail`, `refreshTokens`
- Todo: `createTodo`, `updateTodo`, `deleteTodo`, `toggleTodo`, `addSubtask`, `toggleSubtask`, `removeSubtask`

## Authentication Model

- Clients send `Authorization: Bearer <accessToken>`.
- Resolver-level auth validation is done in `getAuthenticatedUser()` (`src/resolvers/index.js`).
- Access and refresh tokens are generated in `userService` through `utils/jwt.js`.
- Token blacklist checks exist as stubs (currently non-persistent and effectively disabled).

## Data Model Summary

### User

- Identity: `username`, `email`, `password` (hashed)
- Profile: `firstName`, `lastName`, `avatar`
- Status: `isActive`, `emailVerified`, `lastLogin`
- Password is excluded from query output by default

### Todo

- Core: `title`, `description`, `completed`, `priority`, `dueDate`
- Organization: `tags`, `category`
- Ownership/assignment: `createdBy`, `assignedTo`
- Embedded arrays: `attachments`, `reminders`, `subtasks`
- Virtuals: due date formatting, overdue flag, days remaining, completion percentage

## Configuration

Expected environment variables:

- `PORT` (default `4000`)
- `NODE_ENV` (default `development`)
- `ALLOWED_ORIGINS` (comma-separated, default includes `http://localhost:3000`)
- `MONGODB_URI` (required)
- `JWT_SECRET` (required in production)
- `JWT_EXPIRE` (default `7d`)
- `JWT_REFRESH_EXPIRE` (default `30d`)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Set environment variables (`.env`), minimum:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_secret
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

3. Start server:

```bash
npm run dev
```

4. Open:

- `http://localhost:4000/graphql`
- `http://localhost:4000/health`

## Current Implementation Status

Implemented:

- Core user registration/login flow
- JWT access/refresh token creation
- Todo CRUD + filtering + pagination + stats
- Basic subtask add operation

Not yet implemented / partial:

- `toggleSubtask` mutation resolver
- `removeSubtask` mutation resolver
- `verifyEmail` service logic
- `refreshTokens` service logic (resolver exists)
- Persistent token blacklist/revocation storage

## Known Notes

- `package.json` scripts currently reference `server.js` at repo root, but the actual entry file is `src/server.js`.
- Some Express middlewares (`auth`, `validation`) are utility-style and not mounted directly in routes because this project is primarily GraphQL-driven.

## Additional Documentation

- Detailed code walkthrough: [CODEBASE.md](./CODEBASE.md)
