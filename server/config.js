// config.js - Configuration file for server

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gaming-client', // Changed to 127.0.0.1:27017
  sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
  // Add more configs as needed
};