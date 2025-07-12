// config.js - Configuration file for server

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost/gaming-client',
  sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
  // Add more configs as needed
};
