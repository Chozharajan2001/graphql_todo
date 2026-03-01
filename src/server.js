import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import dotenv from 'dotenv';
import { database } from './config/database.js';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './resolvers/index.js';
import { setupGlobalHandlers } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Global error handlers setup
setupGlobalHandlers();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    database: database.getStatus()
  });
});

// API documentation endpoint
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GraphQL Todo API</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .endpoint h3 { margin-top: 0; color: #333; }
        code { background: #eee; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 GraphQL Todo API</h1>
        <p>Welcome to your GraphQL Todo application server!</p>
        
        <div class="endpoint">
          <h3>🎮 GraphQL Playground</h3>
          <p>Access the interactive GraphQL playground at: <code>/graphql</code></p>
        </div>
        
        <div class="endpoint">
          <h3>💚 Health Check</h3>
          <p>Monitor server health at: <code>/health</code></p>
        </div>
        
        <div class="endpoint">
          <h3>📚 Getting Started</h3>
          <ol>
            <li>Register a new user using the <code>register</code> mutation</li>
            <li>Log in using the <code>login</code> mutation to get your tokens</li>
            <li>Add the Authorization header: <code>Bearer [your-access-token]</code></li>
            <li>Create and manage your todos!</li>
          </ol>
        </div>
        
        <div class="endpoint">
          <h3>🔧 Server Info</h3>
          <p><strong>Environment:</strong> ${NODE_ENV}</p>
          <p><strong>Port:</strong> ${PORT}</p>
          <p><strong>Started:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// GraphQL context function
const createContext = async ({ req }) => {
  return { req };
};

// Create Apollo Server
const createApolloServer = async () => {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: createContext,
    introspection: NODE_ENV !== 'production',
    playground: NODE_ENV !== 'production',
    formatError: (err) => {
      // Don't expose internal errors in production
      if (NODE_ENV === 'production' && !err.extensions?.code) {
        return {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        };
      }
      return err;
    },
    plugins: [
      {
        // Request logging plugin
        requestDidStart() {
          return {
            didEncounterErrors(requestContext) {
              console.error('GraphQL Errors:', requestContext.errors);
            }
          };
        }
      }
    ]
  });

  return server;
};

// Start server function
const startServer = async () => {
  try {
    // Connect to database
    console.log('Connecting to database...');
    await database.connect();
    
    // Create and start Apollo Server
    console.log('Starting Apollo Server...');
    const apolloServer = await createApolloServer();
    await apolloServer.start();
    
    // Apply GraphQL middleware
    apolloServer.applyMiddleware({ 
      app, 
      path: '/graphql',
      cors: false // Disable CORS for Apollo Server as we handle it globally
    });
    
    // Start Express server
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 GraphQL Todo API Server Started!');
      console.log('='.repeat(50));
      console.log(`📡 Environment: ${NODE_ENV}`);
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`🎮 GraphQL: http://localhost:${PORT}/graphql`);
      console.log(`💚 Health: http://localhost:${PORT}/health`);
      console.log(`🗄️  Database: Connected`);
      console.log('='.repeat(50));
      console.log('💡 Tip: Visit /graphql for the interactive playground');
      console.log('='.repeat(50) + '\n');
    });
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      
      try {
        // Close database connection
        await database.disconnect();
        console.log('Database connection closed');
        
        // Close server
        server.close(() => {
          console.log('Server closed');
          process.exit(0);
        });
        
        // Force close after 10 seconds
        setTimeout(() => {
          console.error('Force closing after 10 seconds');
          process.exit(1);
        }, 10000);
        
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();