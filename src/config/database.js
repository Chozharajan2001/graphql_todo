import mongoose from 'mongoose';

/**
 * Database connection configuration
 * Handles MongoDB Atlas connection with proper error handling and reconnection logic
 */

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Connect to MongoDB database
   * @param {string} uri - MongoDB connection URI
   * @returns {Promise<mongoose.Connection>} Database connection
   */
  async connect(uri = process.env.MONGODB_URI) {
    if (this.isConnected) {
      console.log('Already connected to database');
      return mongoose.connection;
    }

    if (!uri) {
      throw new Error('MongoDB URI is required. Please set MONGODB_URI in environment variables.');
    }

    try {
      console.log('Connecting to MongoDB...');
      
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000, // 30 seconds
        socketTimeoutMS: 45000, // 45 seconds
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        heartbeatFrequencyMS: 10000, // Send keepalive every 10 seconds
      };

      // Connect to MongoDB
      await mongoose.connect(uri, options);
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      console.log('MongoDB connected successfully');
      return mongoose.connection;
      
    } catch (error) {
      this.isConnected = false;
      this.connectionAttempts++;
      
      console.error('MongoDB connection error:', error.message);
      
      // Retry logic for transient errors
      if (this.connectionAttempts < this.maxRetries) {
        console.log(`Retrying connection in ${this.retryDelay / 1000} seconds... (Attempt ${this.connectionAttempts}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect(uri);
      }
      
      throw new Error(`Failed to connect to MongoDB after ${this.maxRetries} attempts: ${error.message}`);
    }
  }

  /**
   * Disconnect from database
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('Disconnected from MongoDB');
    }
  }

  /**
   * Get connection status
   * @returns {object} Connection status information
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  /**
   * Handle connection events
   */
  setupEventListeners() {
    // Connection successful
    mongoose.connection.on('connected', () => {
      console.log('Connected to MongoDB');
      this.isConnected = true;
    });

    // Connection error
    mongoose.connection.on('error', (err) => {
      console.error('Connection error:', err);
      this.isConnected = false;
    });

    // Disconnected
    mongoose.connection.on('disconnected', () => {
      console.log('Disconnected from MongoDB');
      this.isConnected = false;
    });

    // Reconnected
    mongoose.connection.on('reconnected', () => {
      console.log('Reconnected to MongoDB');
      this.isConnected = true;
    });

    // Close event
    mongoose.connection.on('close', () => {
      console.log('Connection closed');
      this.isConnected = false;
    });

    // SIGINT handling for graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT signal. Closing MongoDB connection...');
      await this.disconnect();
      process.exit(0);
    });

    // SIGTERM handling for graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM signal. Closing MongoDB connection...');
      await this.disconnect();
      process.exit(0);
    });

    // Uncaught exception handling
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught Exception:', error);
      await this.disconnect();
      process.exit(1);
    });

    // Unhandled rejection handling
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      await this.disconnect();
      process.exit(1);
    });
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>} Connection test result
   */
  async testConnection(uri = process.env.MONGODB_URI) {
    try {
      const testConnection = await mongoose.createConnection(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
      });
      
      await testConnection.close();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<object>} Database statistics
   */
  async getDatabaseStats() {
    if (!this.isConnected) {
      throw new Error('Not connected to database');
    }

    try {
      const db = mongoose.connection.db;
      const admin = db.admin();
      
      // Get database stats
      const dbStats = await db.stats();
      
      // Get collection info
      const collections = await db.listCollections().toArray();
      
      return {
        dbName: db.databaseName,
        collections: collections.length,
        objects: dbStats.objects,
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize,
        indexes: dbStats.indexes,
        indexSize: dbStats.indexSize,
        collectionNames: collections.map(col => col.name)
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  /**
   * Ping database to check connectivity
   * @returns {Promise<object>} Ping result
   */
  async ping() {
    if (!this.isConnected) {
      throw new Error('Not connected to database');
    }

    try {
      const db = mongoose.connection.db;
      const admin = db.admin();
      const result = await admin.ping();
      return result;
    } catch (error) {
      console.error('Database ping failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const database = new DatabaseConnection();

// Export configured mongoose instance and connection methods
export { database };
export default mongoose;