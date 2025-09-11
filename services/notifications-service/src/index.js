require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('colors');

const notificationRoutes = require('./routes/notifications');
const { connectRabbitMQ, startEventListeners } = require('./config/rabbitmq');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    service: 'notifications-service',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize RabbitMQ connection and start event listeners
const startServer = async () => {
  try {
    console.log('📩 Starting Notifications Service...'.cyan);
    
    await connectRabbitMQ();
    console.log('✅ RabbitMQ connected successfully'.green);
    
    await startEventListeners();
    console.log('🎧 Event listeners started successfully'.green);
    
    app.listen(PORT, () => {
      console.log(`📩 Notifications service running on port ${PORT}`.cyan);
    });
  } catch (error) {
    console.error('❌ Failed to start server:'.red, error);
    console.log('⚠️  Starting server without RabbitMQ connection...'.yellow);
    
    app.listen(PORT, () => {
      console.log(`📩 Notifications service running on port ${PORT} (RabbitMQ connection failed)`.yellow);
    });
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Shutting down notifications service...'.yellow);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Terminating notifications service...'.yellow);
  process.exit(0);
});

startServer();

module.exports = app;