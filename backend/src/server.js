'use strict';

const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  ExportReady Business API Microservice`);
  console.log(`  Port: http://localhost:${PORT}`);
  console.log(`  Health Check: http://localhost:${PORT}/health`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=======================================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

module.exports = server;
