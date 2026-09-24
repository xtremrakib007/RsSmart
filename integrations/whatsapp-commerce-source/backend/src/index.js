import express from 'express';
import dotenv from 'dotenv';
import { configureMiddleware } from './config/middleware.js';
import { connectDatabase } from './database/connection.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimiter.js';
import routes from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure middleware (CORS, security, body parsing)
configureMiddleware(app);

// Health check route (before rate limiting for monitoring)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'whatsapp-commerce-api'
  });
});

// Rate limiting for API routes
app.use('/api/auth', rateLimit('auth'));
app.use('/api', rateLimit('api'));
app.use('/api/webhooks', rateLimit('webhook'));

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`\n✅ WhatsApp Commerce API running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/api/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
